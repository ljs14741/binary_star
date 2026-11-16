// 밤의 언덕 3D 장면 (three.js). React 와 분리된 클래스
// 하늘: 황도 12궁 별자리가 카메라 둘레 360도에 고리로 떠 있음. 주제 방이 붙은 별자리는 이야기 별로 채워지고, 없는 별자리는 흐리게 모양만
//       끌어서 돌아보고(관성), 고른 별자리만 밝고 크게. 이름(별자리·주제)은 모양 아래 글자
// 언덕: 바다 위 작은 섬. 별 요정들이 모닥불 둘레에 앉아 있음. 땅을 누르면 걸어가고, PC 는 방향키를 누르는 동안만 걸음
// 풍경: 오로라(왼쪽 뒤) · 바다 · 등대(앞 오른쪽) · 모닥불 · 가끔 돌고래 (scenery.ts)
import * as THREE from "three";
import type { SkyData, SkyStar } from "@/lib/hill";
import type { Lang } from "@/lib/i18n/config";
import type { Gesture, MemberPublic, Pose, StarEvent } from "@/lib/realtime/protocol";
import { FIRE_KEEP_OUT, FIRE_POS, HILL_HALF_D, HILL_HALF_W, onDock, TREE_POS, WISH_DOCK } from "@/lib/realtime/protocol";
import type { Sfx } from "@/lib/sound";
import { CREATURE_KINDS, creatureTexture, glowTexture, heartTexture, lanternTexture, moonTexture, ME_PALETTE, PALETTES, textTexture, wrapTitle, type CreatureKind, type Palette } from "./sprites";
import { assignRooms, ZODIAC, type Shape } from "./constellations";
import { Scenery } from "./scenery";
import { isSnowSeason, moonIllumination, moonPhase } from "./season";
import { ChristmasTree } from "./tree";
import { azDelta, type Cell, DOME_R, fromAngles, hfovOf, ringLayout, SKY_ORIGIN, SKY_V_CENTER, starAlpha, starPoint, starSize } from "./sky";

export type HighlightInfo = { star: SkyStar; roomIndex: number } | null;

export type SceneOpts = {
    lang: Lang;
    emptyLabel: string; // 주제 없는 별자리 아래 글자
    onStarTap: (id: number) => void;
    onGroundTap: (x: number, z: number) => void;
    // 방향키 걷기: 150ms 마다 위치, 멈추면 moving=false 로 한 번 더
    onWalk: (x: number, z: number, moving: boolean) => void;
    onIndexChange: (index: number) => void;
    onHighlight: (h: HighlightInfo) => void;
    onSfx: (name: Sfx) => void;
    // 내 요정을 눌렀을 때(손 흔들기 등) 서버로 보낼 몸짓
    onGesture: (g: Gesture) => void;
    // 다른 요정을 눌러 마음 보내기
    onGift: (to: number) => void;
    // 소원 부두
    wishLabel: string; // 부두 이름표
    wishSkyLabel: string; // 소원 하늘 이름표 (달 아래)
    onWishGo: () => void; // 부두로 걸어가기 시작 (안내 한 줄)
    onWishArrive: () => void; // 내 요정이 부두 끝에 도착 (소원 창 열기)
    onWishTap: (id: number) => void; // 하늘에 뜬 남의 풍등을 누름
    onTreeTap: () => void; // 크리스마스트리를 누름
    onLookDrag: () => void; // 하늘을 끌어 돌리기 시작 (처음 힌트 끄기)
    getCardRect: () => DOMRect | null; // 가운데 이야기 카드 자리 (부두 이름표가 겹치면 흐리게)
    reduceMotion: boolean;
};

const WALK_SPEED = 1.9;
const KEY_SPEED = 2.8;
const KEY_SEND_MS = 150;
const MAX_STARS = 320;
const HIGHLIGHT_EVERY = 5.5; // 초
const EMPTY_WAIT = 9; // 빈 별자리에 머무는 시간
const IDLE_BEFORE_AUTO = 20; // 마지막 조작 뒤 이만큼 지나야 다음 별자리로 자동으로 넘어감
const WAVE_SEC = 2.2;
const EMOTE_ICON: Record<Gesture, string> = { wave: "👋", heart: "💛", pat: "🤗", tear: "🥲", joy: "😊", lookup: "✨", hug: "🤗" };
const GIFT_SEC = 0.9;
// 눈: 카메라 둘레 상자 안에서 떨어지고 바닥에 닿으면 위로 되돌아감 (CPU 계산 없이 셰이더로)
const SNOW_BOX = 16,
    SNOW_H = 13;
const SNOW_VERT = `
attribute float aSeed; uniform float uTime; uniform float uPixelRatio;
varying float vA;
void main(){
    vec3 p = position;
    float speed = 0.55 + aSeed * 0.5;
    p.y = mod(p.y - uTime * speed, ${SNOW_H.toFixed(1)}) - 1.5;
    p.x += sin(uTime * (0.4 + aSeed * 0.5) + aSeed * 30.0) * 0.35;
    p.z += cos(uTime * (0.3 + aSeed * 0.4) + aSeed * 17.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // 카메라 바로 앞 눈송이가 크게 번지지 않게 상한
    gl_PointSize = min((2.2 + aSeed * 2.6) * (9.0 / max(1.0, -mv.z)), 7.0) * uPixelRatio;
    vA = 0.55 + 0.45 * aSeed;
}`;
const SNOW_FRAG = `
varying float vA;
void main(){
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.1, length(c)) * vA;
    gl_FragColor = vec4(0.93, 0.95, 1.0, a);
}`;

const MOON_AZ = -15,
    MOON_ELEV = 24; // 달 방위·고도(도). 바다 달빛 길(scenery)·부두(WISH_DOCK.az)도 같은 방위. 별자리 띠보다 낮게
// 하늘 고리 = 별자리 12칸 + 소원 하늘 1칸(13번째, 번호 12). 소원 칸이 달(부두 방향)에 오게 고리를 돌림
export const WISH_INDEX = ZODIAC.length;
const RING_N = ZODIAC.length + 1;
const RING_OFFSET = MOON_AZ - WISH_INDEX * (360 / RING_N);
const WISH_HALF = 360 / RING_N / 2 - 2.5; // 풍등이 퍼지는 좌우 폭(도). 옆 별자리와 안 겹치게
const PORTRAIT_CAM_FWD = 3.2; // 세로 화면에서 카메라가 섬 쪽으로 다가가는 거리
// 소원 부두: 모닥불 왼쪽 앞, 달 쪽으로 뻗은 나무 부두 (자리·길이는 protocol 의 WISH_DOCK, 서버도 같은 값으로 부두 위를 허용)
const WISH_SPOT = { x: WISH_DOCK.x, z: WISH_DOCK.z };
const MOON_DIR = { x: Math.sin(MOON_AZ * (Math.PI / 180)), z: -Math.cos(MOON_AZ * (Math.PI / 180)) };
const DOCK_LEN = WISH_DOCK.len;
const WISH_RUN = 1.45; // 부두로 갈 때는 총총 빠르게
const DOCK_CAM_FWD = 4; // 부두 위에 서면 카메라가 이만큼 다가감 (내가 거기 서 있는 느낌)
const TAG_MAX_PX = 24; // 별명표 글자 높이 상한(화면 px)
const TAG_H = 0.28,
    TAG_Y = 1.0; // 별명표 높이·자리(요정 머리 위)
const ORBIT_R = SKY_ORIGIN.z - FIRE_POS.z; // 카메라가 모닥불 둘레를 도는 반지름 (정면일 때 SKY_ORIGIN 자리)
const DEG = Math.PI / 180;
const CAM_Y = SKY_ORIGIN.y;

export function hillHeight(x: number, z: number): number {
    return 1.15 * Math.exp(-(x * x) / 70 - (z * z) / 22) + 0.12 * Math.sin(x * 0.7) * Math.cos(z * 0.9) + 0.05 * Math.sin(x * 2.1 + z * 1.3);
}
// 요정이 서는 높이: 부두 위면 판자 윗면, 아니면 땅
const DOCK_TOP = hillHeight(WISH_DOCK.x, WISH_DOCK.z) + 0.11;
function groundY(x: number, z: number): number {
    return onDock(x, z) ? DOCK_TOP : hillHeight(x, z);
}

type Person = {
    id: number;
    group: THREE.Group;
    body: THREE.Sprite;
    glow: THREE.Mesh;
    pal: Palette;
    target: THREE.Vector2;
    pos: THREE.Vector2;
    pose: Pose;
    bob: number;
    nextBlink: number;
    blinkUntil: number;
    lookUntil: number;
    happyUntil: number;
    walkUntil: number;
    waveUntil: number;
    hearts: { sprite: THREE.Sprite; born: number }[];
    name: string | null;
    tag: THREE.Sprite | null; // 머리 위 별명표
    tagAspect: number;
    tagLift: number; // 다른 이름표와 안 겹치게 위로 올린 높이(월드)
    joyUntil: number; // 깡충
    patUntil: number; // 좌우로 토닥토닥
    tearUntil: number; // 뭉클 (살짝 처짐)
    bubble: { sprite: THREE.Sprite; born: number } | null; // 머리 위 그림 말풍선
};

type Constellation = {
    index: number; // 황도 번호 0~11
    shape: Shape;
    slug: string | null; // 붙은 방
    title: string | null;
    cell: Cell;
    starIds: number[]; // 진짜 별(이야기)만
    lines: THREE.LineSegments;
    linePairs: [number, number][]; // buffer index 쌍
    label: THREE.Sprite; // 주 이름표: 주제 방 이름 (없으면 안내)
    labelAspect: number;
    labelLines: number;
    sub: THREE.Sprite; // 보조: 별자리 이름 (작고 흐리게)
    subAspect: number;
    scale: number;
    scaleTarget: number;
};
// ghost = 이야기가 없는 자리(모양만 보여 주는 흐린 별). px/py = 모양 좌표
type StarRec = { id: number; pos: THREE.Vector3; count: number; mine: boolean; room: number; data: SkyStar; ghost: boolean; px: number; py: number };
type Beam = { line: THREE.Line; spark: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; born: number; life: number };
type Meteor = { line: THREE.Line; vel: THREE.Vector3; born: number; life: number; big: boolean };

const STAR_VERT = `
attribute float aSize; attribute float aAlpha; attribute float aPhase; attribute vec3 aColor; attribute float aBorn; attribute float aHot;
uniform float uTime; uniform float uPixelRatio; uniform float uReduce;
varying float vAlpha; varying vec3 vColor; varying float vHot;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = uReduce > 0.5 ? 0.85 : 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 1.4) + aPhase * 6.28);
    float born = clamp((uTime - aBorn) / 1.6, 0.0, 1.0);
    float pop = born < 1.0 ? 1.0 + (1.0 - born) * 1.8 : 1.0;
    float hot = 1.0 + aHot * (0.55 + 0.15 * sin(uTime * 4.0));
    vAlpha = min(1.0, aAlpha * tw * born + aHot * 0.5);
    vColor = aColor;
    vHot = aHot;
    gl_PointSize = aSize * pop * hot * uPixelRatio;
    gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = `
varying float vAlpha; varying vec3 vColor; varying float vHot;
void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(1.0, 0.15, d) * (0.3 + vHot * 0.3);
    float a = (core + halo) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.65), a);
}`;

const DOME_VERT = `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const DOME_FRAG = `
varying vec3 vPos;
void main(){
    vec3 p = normalize(vPos);
    float h = clamp(p.y, 0.0, 1.0);
    vec3 horizon = vec3(0.11, 0.14, 0.33);
    vec3 zenith = vec3(0.02, 0.03, 0.10);
    vec3 c = mix(horizon, zenith, pow(h, 0.55));
    float band = exp(-pow((p.x * 0.8 + p.y * -0.55 + p.z * 0.25) * 3.2, 2.0));
    c += vec3(0.16, 0.19, 0.32) * band * 0.22 * h;
    c += vec3(0.30, 0.24, 0.34) * exp(-h * 9.0) * 0.30;
    gl_FragColor = vec4(c, 1.0);
}`;

export class HillScene {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera;
    private ground: THREE.Mesh;
    private scenery: Scenery;
    private winter = isSnowSeason();
    private tree: ChristmasTree;
    private snow: THREE.Points | null = null;
    private people = new Map<number, Person>();
    // 하늘(돔·별·별자리·달·오로라·유성)은 아주 멀리 있는 것처럼 카메라를 따라다님. 땅·사람·모닥불은 제자리
    private sky = new THREE.Group();
    private pendingNames = new Map<number, string | null>(); // 사람이 화면에 생기기 전에 온 별명
    private gifts: { sprite: THREE.Sprite; from: number; to: number; born: number }[] = [];
    // 혼자일 때 불 둘레에 앉아 있는 흐린 그림자 요정 (사람 아님: 이름·터치·인원 수 없음)
    private ghosts: { s: THREE.Sprite; phase: number }[] = [];
    // 소원 부두
    private wishPending: 0 | 1 | 2 = 0; // 부두로 걸어가는 중 (1: 부두 입구까지, 2: 부두 끝까지)
    private dockLabel: THREE.Sprite | null = null; // 부두 이름표 (살짝 숨 쉬듯)
    private dockGlow: THREE.Sprite | null = null;
    private dockLabelFade = 1; // 이야기 카드에 가리면 0 으로
    private cardCheckAt = 0;
    private dockNear = 0; // 0~1, 내 요정이 부두 위에 있으면 1 로
    private lanternTex = lanternTexture();
    private lanterns: { s: THREE.Sprite; start: THREE.Vector3; born: number; sway: number }[] = []; // 막 띄운 풍등 (땅 좌표)
    private skyWishes: { id: number; s: THREE.Sprite; g: THREE.Sprite; phase: number; flare: number }[] = []; // 오늘 밤 소원 풍등 (하늘 좌표)
    private dockPoints: THREE.Vector3[] = []; // 부두 누르기 판정용
    private lastEmote = 0;
    private meId: number | null = null;
    private texCache = new Map<string, Record<CreatureKind, THREE.Texture>>();
    private glowMe: THREE.Texture;
    private glowOther: THREE.Texture;
    private heartTex: THREE.Texture;
    private stars: THREE.Points;
    private starGeo: THREE.BufferGeometry;
    private starMat: THREE.ShaderMaterial;
    private starIndex = new Map<number, number>();
    private starList: StarRec[] = [];
    private constellations: Constellation[] = [];
    private bgMat: THREE.ShaderMaterial;
    private beams: Beam[] = [];
    private meteors: Meteor[] = [];
    private nextMeteor = 0;
    private raf = 0;
    private clock = new THREE.Clock();
    private view = 0; // 카메라 방위각(라디안). 0 = 정면(바다)
    private viewTarget: number | null = null; // ‹ › 로 돌 때 목표. null 이면 자유
    private viewVel = 0; // 관성
    private pitch = 0;
    private pitchTarget = 0;
    private index = 0;
    private skyLaid = false;
    private dragging = false;
    // walk: 땅(섬)을 잡고 끌면 내 요정이 손가락을 따라 걸음. look: 하늘을 끌면 돌아봄
    private pointer: {
        x: number;
        y: number;
        moved: boolean;
        id: number;
        startView: number;
        lastX: number;
        lastT: number;
        vel: number;
        mode: "look" | "walk";
        g0: { x: number; z: number } | null;
        me0: { x: number; z: number } | null;
    } | null = null;
    private lastInputAt = -IDLE_BEFORE_AUTO;
    private lastWalkSend = 0;
    private walkMark: THREE.Mesh | null = null;
    private walkMarkUntil = 0;
    private ray = new THREE.Raycaster();
    private visible = true;
    private disposed = false;
    private mineIds = new Set<number>();
    private pendingBorn = new Map<number, THREE.Vector3>();
    private dailyResolve: (() => void) | null = null;
    private highlightAt = 0;
    private highlightStar: number | null = null; // buffer index
    private highlightCursor = -1;
    private keys = new Set<string>();
    private keyWalking = false;
    private lastKeySend = 0;
    private isMobile: boolean;
    private selScale: number;
    private portrait = false; // 세로 화면(폰): 3D 안 이름표를 숨김 (머리글에 같은 글자가 있음)
    private horizonPct = -1; // 수평선의 화면 세로 위치(%). 바뀌면 --hill-horizon 으로 내보내 카드가 그 위에 붙음

    constructor(
        private canvas: HTMLCanvasElement,
        private opts: SceneOpts,
    ) {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        this.isMobile = isMobile;
        this.selScale = isMobile ? 1.3 : 1.2;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: "low-power" });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R * 1.35, 24, 16), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false }));
        this.scene.add(this.sky);
        this.sky.add(dome);
        this.ground = this.makeGround();
        this.scene.add(this.ground);
        this.scene.add(this.makeFarHills());
        this.scenery = new Scenery({ reduceMotion: opts.reduceMotion, isMobile }, FIRE_POS.x, FIRE_POS.z, hillHeight(FIRE_POS.x, FIRE_POS.z));
        this.scene.add(this.scenery.group);
        this.sky.add(this.scenery.sky);
        this.scene.add(this.makeDock());
        this.tree = new ChristmasTree(TREE_POS.x, groundY(TREE_POS.x, TREE_POS.z) - 0.05, TREE_POS.z, !!opts.reduceMotion);
        this.scene.add(this.tree.group);

        // 달: 정면 왼쪽 별자리 칸 사이(az -15), 별자리 띠 높이(고도 33). 작게 해서 이름표·문장 카드·칸과 안 겹치고, 폰 왼쪽 가장자리 안에 들어옴
        // 실제 오늘 달 모양. 가늘수록 둘레 빛·바다 달빛 길도 옅게
        const phase = moonPhase();
        const illum = moonIllumination(phase);
        const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,236,196"), transparent: true, opacity: 0.14 + 0.28 * illum, depthWrite: false, blending: THREE.AdditiveBlending }));
        const moonAt = fromAngles(MOON_AZ, MOON_ELEV, DOME_R * 1.1);
        moonGlow.position.set(moonAt.x, moonAt.y, moonAt.z);
        moonGlow.scale.set(11, 11, 1);
        this.sky.add(moonGlow);
        const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(phase), transparent: true, opacity: 1, depthWrite: false }));
        moon.position.copy(moonGlow.position);
        moon.scale.set(4.2, 4.2, 1);
        this.sky.add(moon);
        this.scenery.setMoonLight(illum);
        // 달 아래 이름표: 별자리 칸처럼 "여기는 소원 하늘"
        const wl = textTexture(`🏮 ${opts.wishSkyLabel}`, { size: 44, color: "#ffe2b0", font: "600", pad: 24 });
        const wishLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: wl.tex, transparent: true, depthWrite: false, opacity: 0.55 }));
        const wlAt = fromAngles(MOON_AZ, MOON_ELEV - 5.5, DOME_R * 1.05);
        wishLabel.position.set(wlAt.x, wlAt.y, wlAt.z);
        wishLabel.scale.set(2.3 * wl.aspect, 2.3, 1);
        this.sky.add(wishLabel);

        // 겨울(12~2월)엔 눈. 움직임 줄이기를 켠 사람에겐 안 내림
        if (this.winter && !opts.reduceMotion) {
            this.snow = this.makeSnow(isMobile ? 380 : 750);
            this.scene.add(this.snow);
        }

        const bg = this.makeBackgroundStars(isMobile ? 600 : 900);
        this.bgMat = bg.material as THREE.ShaderMaterial;
        this.sky.add(bg);

        this.starGeo = new THREE.BufferGeometry();
        this.starGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_STARS * 3), 3));
        for (const k of ["aSize", "aAlpha", "aPhase", "aBorn", "aHot"]) this.starGeo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(MAX_STARS), 1));
        this.starGeo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(MAX_STARS * 3), 3));
        this.starGeo.setDrawRange(0, 0);
        this.starMat = new THREE.ShaderMaterial({
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG,
            uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() }, uReduce: { value: opts.reduceMotion ? 1 : 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.stars = new THREE.Points(this.starGeo, this.starMat);
        this.stars.frustumCulled = false;
        this.sky.add(this.stars);

        this.glowMe = glowTexture("255,216,107");
        this.glowOther = glowTexture("170,180,255");
        this.heartTex = heartTexture();

        this.resize();
        window.addEventListener("resize", this.resize);
        canvas.addEventListener("pointerdown", this.onDown);
        canvas.addEventListener("pointermove", this.onMove);
        canvas.addEventListener("pointerup", this.onUp);
        canvas.addEventListener("pointercancel", this.onCancel);
        // 터치 뒤 브라우저가 만드는 click 을 막음. 안 막으면 그 click 이 방금 열린 창(풍등 소원 등)의 배경에 떨어져 바로 닫힘
        canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
        window.addEventListener("keydown", this.onKey);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        document.addEventListener("visibilitychange", this.onVis);
        this.nextMeteor = 5 + Math.random() * 8;
        this.loop();
    }

    // ---------- 만들기 ----------
    private makeSnow(n: number): THREE.Points {
        const pos = new Float32Array(n * 3),
            seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() * 2 - 1) * SNOW_BOX;
            pos[i * 3 + 1] = Math.random() * SNOW_H;
            pos[i * 3 + 2] = (Math.random() * 2 - 1) * SNOW_BOX;
            seed[i] = Math.random();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
        const mat = new THREE.ShaderMaterial({
            vertexShader: SNOW_VERT,
            fragmentShader: SNOW_FRAG,
            uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() } },
            transparent: true,
            depthWrite: false,
        });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        return pts;
    }

    private makeGround(): THREE.Mesh {
        // 바다 위 섬: 가운데 언덕, 가장자리는 물로 내려가는 비탈
        const W = 60,
            D = 60,
            sx = 90,
            sz = 90;
        const geo = new THREE.PlaneGeometry(W, D, sx, sz);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const colors = new Float32Array(pos.count * 3);
        const top = new THREE.Color("#161f4c"),
            bottom = new THREE.Color("#070b1f"),
            edge = new THREE.Color("#04061a"),
            warm = new THREE.Color("#4a2a1c"),
            snowTint = new THREE.Color("#5d6896");
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i),
                z = pos.getZ(i);
            const r = Math.hypot(x * 0.62, z) + Math.sin(Math.atan2(z, x) * 3) * 0.6;
            const shore = Math.max(0, (r - 11) / 8);
            const y = hillHeight(x, z) - Math.pow(shore, 1.4) * 2.6;
            pos.setY(i, y);
            const t = THREE.MathUtils.clamp(y / 1.25, 0, 1);
            const far = THREE.MathUtils.clamp(r / 16 + shore * 0.5, 0, 1);
            const c = bottom
                .clone()
                .lerp(top, t)
                .lerp(edge, far * far);
            // 모닥불 둘레는 살짝 따뜻하게
            const df = Math.hypot(x - FIRE_POS.x, z - FIRE_POS.z);
            // 겨울: 언덕 높은 곳일수록 눈이 덮임. 모닥불 둘레는 녹아서 맨땅
            if (this.winter) c.lerp(snowTint, t * (1 - far) * 0.55 * THREE.MathUtils.smoothstep(df, 2.2, 4.8));
            c.lerp(warm, Math.max(0, 1 - df / 4.2) * 0.6);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    }

    private makeFarHills(): THREE.Object3D {
        // 건너편 산 실루엣 (옆·뒤). 앞은 바다
        const g = new THREE.Group();
        const mk = (seed: number, color: string, y: number, dist: number, h: number, az: number) => {
            const c = document.createElement("canvas");
            c.width = 1024;
            c.height = 256;
            const x = c.getContext("2d")!;
            x.fillStyle = color;
            x.beginPath();
            x.moveTo(0, 256);
            for (let i = 0; i <= 1024; i += 8) {
                const t = i / 1024;
                x.lineTo(i, 150 - 60 * Math.sin(t * 3.1 + seed) - 35 * Math.sin(t * 7.3 + seed * 2.1) - 15 * Math.sin(t * 17 + seed * 3.7));
            }
            x.lineTo(1024, 256);
            x.closePath();
            x.fill();
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(160, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
            m.position.set(Math.sin(az) * dist, y, -Math.cos(az) * dist);
            m.rotation.y = -az;
            return m;
        };
        for (let k = 1; k < 4; k++) {
            const az = (k * Math.PI) / 2;
            g.add(mk(1.3 + k, "#0a0f2a", 5, 70, 22, az));
            g.add(mk(4.1 + k, "#070b1f", 2.5, 52, 16, az));
        }
        return g;
    }

    private makeBackgroundStars(n: number): THREE.Points {
        const pos = new Float32Array(n * 3),
            size = new Float32Array(n),
            alpha = new Float32Array(n),
            phase = new Float32Array(n),
            born = new Float32Array(n),
            hot = new Float32Array(n),
            color = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const az = (Math.random() * 2 - 1) * Math.PI;
            const elev = Math.asin(Math.random()) * 0.98 + 0.02;
            const r = DOME_R * 1.25;
            pos[i * 3] = r * Math.cos(elev) * Math.sin(az);
            pos[i * 3 + 1] = r * Math.sin(elev);
            pos[i * 3 + 2] = -r * Math.cos(elev) * Math.cos(az);
            size[i] = 1.2 + Math.random() * 1.8;
            alpha[i] = 0.25 + Math.random() * 0.55;
            phase[i] = Math.random();
            born[i] = -10;
            const warm = Math.random() < 0.3;
            color[i * 3] = warm ? 1 : 0.9;
            color[i * 3 + 1] = warm ? 0.9 : 0.93;
            color[i * 3 + 2] = warm ? 0.7 : 1;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
        geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
        geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
        geo.setAttribute("aBorn", new THREE.BufferAttribute(born, 1));
        geo.setAttribute("aHot", new THREE.BufferAttribute(hot, 1));
        geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
        const mat = new THREE.ShaderMaterial({
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG,
            uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() }, uReduce: { value: this.opts.reduceMotion ? 1 : 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const p = new THREE.Points(geo, mat);
        p.frustumCulled = false;
        return p;
    }

    // ---------- 하늘(별자리) ----------
    private clearSky() {
        for (const c of this.constellations) {
            this.sky.remove(c.lines);
            c.lines.geometry.dispose();
            (c.lines.material as THREE.Material).dispose();
            for (const s of [c.label, c.sub]) {
                this.sky.remove(s);
                (s.material as THREE.SpriteMaterial).map?.dispose();
                s.material.dispose();
            }
        }
        this.constellations = [];
        this.starList = [];
        this.starIndex.clear();
        this.pendingBorn.clear();
        this.highlightStar = null;
    }

    setSky(data: SkyData, mineIds: number[]) {
        this.mineIds = new Set(mineIds);
        const prevScale = new Map(this.constellations.map((c) => [c.index, c.scale]));
        this.clearSky();
        const now = this.clock.getElapsedTime();
        const cells = ringLayout(RING_N, RING_OFFSET);
        // 처음 그릴 때 시선을 0번 별자리에 맞춤 (고리를 돌려서 정면이 아님)
        if (!this.skyLaid) {
            this.skyLaid = true;
            this.view = cells[0].az * DEG;
        }
        const assign = assignRooms(data.rooms.map((r) => r.slug));
        const roomAt = new Map<number, (typeof data.rooms)[number]>();
        for (const r of data.rooms) {
            const zi = assign.get(r.slug);
            if (zi != null) roomAt.set(zi, r);
        }
        ZODIAC.forEach((shape, zi) => {
            const cell = cells[zi];
            const room = roomAt.get(zi) ?? null;
            const ids: number[] = [];
            const slotToBuf = new Map<number, number>();
            for (let si = 0; si < shape.points.length; si++) {
                if (this.starList.length >= MAX_STARS) break;
                const s = room?.stars[si];
                const [px, py] = shape.points[si];
                const i = this.starList.length;
                const v = new THREE.Vector3();
                if (s && room) {
                    const mine = this.mineIds.has(s.id);
                    this.starList.push({ id: s.id, pos: v, count: s.c, mine, room: zi, data: s, ghost: false, px, py });
                    this.starIndex.set(s.id, i);
                    ids.push(s.id);
                } else {
                    // 빈 자리: 모양만 보여 주는 흐린 별
                    const gid = -(zi * 100 + si + 1);
                    this.starList.push({ id: gid, pos: v, count: 0, mine: false, room: zi, data: { id: gid, room: room?.slug ?? "", c: 0, lang: "", nick: null, line: "", at: 0 }, ghost: true, px, py });
                    this.starIndex.set(gid, i);
                }
                this.writeStar(i, now - 10 + si * 0.08);
                slotToBuf.set(si, i);
            }
            const linePairs: [number, number][] = [];
            for (const [a, b] of shape.lines) {
                const ia = slotToBuf.get(a),
                    ib = slotToBuf.get(b);
                if (ia != null && ib != null) linePairs.push([ia, ib]);
            }
            const lgeo = new THREE.BufferGeometry();
            lgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePairs.length * 6), 3));
            const lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0xc9d4ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
            this.sky.add(lines);
            // 이름표: 주제 방 이름이 주(없으면 안내), 그 아래 별자리 이름은 작고 흐리게
            const labelText = room ? wrapTitle(room.title, this.isMobile ? 9 : 12) : this.opts.emptyLabel;
            const zl = textTexture(labelText, { size: 44, color: "#ffffff", font: room ? "600" : "400", pad: 24 });
            const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: zl.tex, transparent: true, depthWrite: false, opacity: 0.6 }));
            const sl = textTexture(`${shape.symbol} ${shape.names[this.opts.lang]}`, { size: 30, color: "#ffffff", font: "400", pad: 20 });
            const sub = new THREE.Sprite(new THREE.SpriteMaterial({ map: sl.tex, transparent: true, depthWrite: false, opacity: 0.3 }));
            this.sky.add(label, sub);
            const sc = prevScale.get(zi) ?? (zi === this.index ? this.selScale : 1);
            this.constellations.push({
                index: zi,
                shape,
                slug: room?.slug ?? null,
                title: room?.title ?? null,
                cell,
                starIds: ids,
                lines,
                linePairs,
                label,
                labelAspect: zl.aspect,
                labelLines: labelText.split("\n").length,
                sub,
                subAspect: sl.aspect,
                scale: sc,
                scaleTarget: sc,
            });
        });
        this.starGeo.setDrawRange(0, this.starList.length);
        this.applyLabelVisibility();
        this.applySelection();
        for (const c of this.constellations) this.placeConstellation(c);
        this.flagStarAttrs();
        this.highlightAt = now + 1.2;
        this.highlightCursor = -1;
    }

    // 별자리의 별·선·이름표 위치를 지금 scale 로 다시 계산
    private placeConstellation(c: Constellation) {
        const posAttr = this.starGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < this.starList.length; i++) {
            const s = this.starList[i];
            if (s.room !== c.index) continue;
            const p = starPoint(c.cell, s.px, s.py, c.scale);
            s.pos.set(p.x, p.y, p.z);
            if (!this.pendingBorn.has(s.id)) posAttr.setXYZ(i, p.x, p.y, p.z);
        }
        const lp = c.lines.geometry.attributes.position as THREE.BufferAttribute;
        c.linePairs.forEach(([a, b], k) => {
            const pa = this.starList[a].pos,
                pb = this.starList[b].pos;
            lp.setXYZ(k * 2, pa.x, pa.y, pa.z);
            lp.setXYZ(k * 2 + 1, pb.x, pb.y, pb.z);
        });
        lp.needsUpdate = true;
        c.lines.geometry.computeBoundingSphere();
        // 이름표: 모양 바로 아래 주제, 그 아래 작은 별자리 이름
        const sel = c.index === this.index;
        const base = 2.4 * (sel ? 1.12 : 1) * (this.isMobile ? 1.1 : 1);
        const cellW = Math.tan(c.cell.half * 1.35 * DEG) * 2 * DOME_R;
        const extra = c.labelLines - 1; // 두 줄이면 그만큼 아래로
        let lh = base * (extra > 0 ? 0.9 * c.labelLines : 1) * (c.slug ? 1 : 0.78); // 주제 없는 안내는 조금 작게
        if (lh * c.labelAspect > cellW) lh = cellW / c.labelAspect;
        const y1 = -1.28 - 0.08 * c.scale - 0.2 * extra;
        const l1 = starPoint(c.cell, 0, y1, c.scale);
        c.label.position.set(l1.x, l1.y, l1.z);
        c.label.scale.set(lh * c.labelAspect, lh, 1);
        const sh = Math.min(base * 0.5, cellW / c.subAspect);
        const l2 = starPoint(c.cell, 0, y1 - 0.34 - 0.2 * extra, c.scale);
        c.sub.position.set(l2.x, l2.y, l2.z);
        c.sub.scale.set(sh * c.subAspect, sh, 1);
        posAttr.needsUpdate = true;
    }

    // 고른 별자리만 밝게·크게. 나머지는 흐리게. 주제 없는 별자리는 더 흐리게
    private applySelection() {
        for (const c of this.constellations) {
            const sel = c.index === this.index;
            c.scaleTarget = sel ? this.selScale : 1;
            (c.lines.material as THREE.LineBasicMaterial).opacity = sel ? 0.45 : c.slug ? 0.16 : 0.09;
            const lm = c.label.material as THREE.SpriteMaterial;
            lm.opacity = sel ? 1 : c.slug ? 0.62 : 0.38;
            lm.color.set(sel ? 0xffd86b : c.slug ? 0xffffff : 0xc9d4ff);
            // 별자리 이름은 늘 보조라 흐리게
            const sm = c.sub.material as THREE.SpriteMaterial;
            sm.opacity = sel ? 0.5 : c.slug ? 0.3 : 0.2;
            sm.color.set(0xc9d4ff);
        }
        const now = this.clock.getElapsedTime();
        for (let i = 0; i < this.starList.length; i++) this.writeStar(i, (this.starGeo.attributes.aBorn as THREE.BufferAttribute).getX(i), now);
        this.flagStarAttrs();
    }

    count(): number {
        return this.constellations.length;
    }

    // 별자리 고르기 (‹ › · 띠 · 쓸기 · 별자리 누르기). 카메라가 그쪽으로 돎
    goTo(index: number) {
        if (this.constellations.length === 0) return;
        const n = this.constellations.length + 1; // + 소원 하늘
        const next = ((index % n) + n) % n;
        this.select(next);
        // 가장 가까운 방향으로 돌기
        const want = (next === WISH_INDEX ? MOON_AZ : this.constellations[next].cell.az) * DEG;
        const cur = this.view;
        const full = Math.PI * 2;
        let t = want;
        while (t - cur > full / 2) t -= full;
        while (t - cur < -full / 2) t += full;
        this.viewTarget = t;
        this.viewVel = 0;
    }

    // 주제가 있는 다음/이전 별자리로. withWish 면 소원 하늘도 한 칸으로 들름(‹ › 화살표)
    goToRoom(dir: number, withWish = true) {
        if (!this.constellations.length) return;
        const n = this.constellations.length + 1;
        for (let k = 1; k <= n; k++) {
            const i = (((this.index + dir * k) % n) + n) % n;
            if (i === WISH_INDEX ? withWish : this.constellations[i].slug) {
                this.goTo(i);
                return;
            }
        }
        this.goTo(this.index + dir);
    }

    private select(next: number) {
        if (next === this.index) return;
        this.index = next;
        this.opts.onIndexChange(next);
        this.highlightCursor = -1;
        // 주제 없는 별자리를 골랐으면 바로 넘어가지 않고 잠시 머묾
        this.highlightAt = this.clock.getElapsedTime() + (this.constellations[next]?.starIds.length ? 0.9 : EMPTY_WAIT);
        this.setHighlight(null);
        this.applySelection();
    }

    // 지금 보는 방향에서 가장 가까운 별자리
    private nearestToView(): number {
        let best = this.index,
            bestD = Infinity;
        const az = this.view / DEG;
        for (const c of this.constellations) {
            const d = Math.abs(azDelta(c.cell.az, az));
            if (d < bestD) {
                bestD = d;
                best = c.index;
            }
        }
        if (this.constellations.length && Math.abs(azDelta(MOON_AZ, az)) < bestD) best = WISH_INDEX;
        return best;
    }

    private writeStar(i: number, born: number, now?: number) {
        const s = this.starList[i];
        const c = this.constellations[s.room];
        const sel = s.room === this.index;
        const hasRoom = !!c?.slug;
        (this.starGeo.attributes.position as THREE.BufferAttribute).setXYZ(i, s.pos.x, s.pos.y, s.pos.z);
        const size = s.ghost ? 1.9 : starSize(s.count) * (s.mine ? 1.25 : 1);
        (this.starGeo.attributes.aSize as THREE.BufferAttribute).setX(i, size * (sel ? 1.1 : 0.9) * 3.6);
        const alpha = s.ghost ? (sel ? 0.34 : hasRoom ? 0.18 : 0.14) : starAlpha(s.count) * (sel ? 1 : 0.45);
        (this.starGeo.attributes.aAlpha as THREE.BufferAttribute).setX(i, alpha);
        (this.starGeo.attributes.aPhase as THREE.BufferAttribute).setX(i, ((i * 37) % 100) / 100);
        (this.starGeo.attributes.aBorn as THREE.BufferAttribute).setX(i, born);
        if (now == null || this.highlightStar !== i) (this.starGeo.attributes.aHot as THREE.BufferAttribute).setX(i, 0);
        const col = this.starGeo.attributes.aColor as THREE.BufferAttribute;
        if (s.ghost) col.setXYZ(i, 0.62, 0.72, 1);
        else if (s.mine) col.setXYZ(i, 1, 0.62, 0.72);
        else col.setXYZ(i, 1, 0.87, 0.55);
    }

    private flagStarAttrs() {
        for (const k of ["position", "aSize", "aAlpha", "aPhase", "aBorn", "aHot", "aColor"]) (this.starGeo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    }

    // 별 하나를 밝히고(하이라이트) 화면에 문장 보여 주기
    private setHighlight(i: number | null) {
        const hot = this.starGeo.attributes.aHot as THREE.BufferAttribute;
        if (this.highlightStar != null) hot.setX(this.highlightStar, 0);
        this.highlightStar = i;
        if (i != null) {
            hot.setX(i, 1);
            const st = this.starList[i];
            this.opts.onHighlight({ star: st.data, roomIndex: st.room });
            // 요정들이 그 별을 올려다봄
            const until = this.clock.getElapsedTime() + 2.2;
            for (const p of this.people.values()) if (Math.random() < 0.7) p.lookUntil = until;
        } else this.opts.onHighlight(null);
        hot.needsUpdate = true;
    }

    // 고른 별자리의 별을 하나씩. 다 돌면 주제 있는 다음 별자리로 (가만히 두면 하늘을 한 바퀴 둘러봄)
    private advanceHighlight(): number {
        const c = this.constellations[this.index];
        if (!c) return HIGHLIGHT_EVERY;
        // 방금 조작했으면(걷기·끌기·누르기) 별자리를 자동으로 바꾸지 않음. 지금 별자리의 별만 돌림
        const idle = this.clock.getElapsedTime() - this.lastInputAt >= IDLE_BEFORE_AUTO;
        if (c.starIds.length === 0) {
            if (idle) this.goToRoom(1, false);
            return HIGHLIGHT_EVERY;
        }
        if (this.highlightCursor + 1 >= c.starIds.length) {
            if (idle) {
                this.goToRoom(1, false);
                return 0.9;
            }
            this.highlightCursor = -1;
        }
        this.highlightCursor++;
        const i = this.starIndex.get(c.starIds[this.highlightCursor]);
        if (i != null) {
            this.setHighlight(i);
            this.opts.onSfx("twinkle");
        }
        return HIGHLIGHT_EVERY;
    }

    // 방금 쓴 내 별: 그 별자리로 돌고 별이 톡 커지며(태어나는 움직임) 강조. 하늘에 없으면 false
    celebrateStar(id: number): boolean {
        const i = this.starIndex.get(id);
        if (i == null) return false;
        const now = this.clock.getElapsedTime();
        this.starList[i].mine = true;
        this.mineIds.add(id);
        this.writeStar(i, now, now);
        for (const k of ["aSize", "aAlpha", "aBorn", "aColor"]) (this.starGeo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
        this.highlightById(id);
        this.lastInputAt = now;
        return true;
    }

    // 이야기 창의 "다음 이야기": 같은 별자리 다음 별, 끝이면 별 있는 다음 별자리 첫 별
    nextStarId(id: number): number | null {
        const i = this.starIndex.get(id);
        const n = this.constellations.length;
        if (i == null || !n) return null;
        const room = this.starList[i].room;
        const ids = this.constellations[room]?.starIds ?? [];
        const k = ids.indexOf(id);
        if (k >= 0 && k + 1 < ids.length) return ids[k + 1];
        for (let d = 1; d <= n; d++) {
            const c = this.constellations[(room + d) % n];
            if (c.starIds.length) return c.starIds[0];
        }
        return null;
    }

    // 특정 별 강조 (문장 카드를 눌렀을 때 등)
    highlightById(id: number) {
        const i = this.starIndex.get(id);
        if (i == null) return;
        const st = this.starList[i];
        if (st.room !== this.index) this.goTo(st.room);
        const c = this.constellations[st.room];
        this.highlightCursor = c ? c.starIds.indexOf(id) : -1;
        this.setHighlight(i);
        this.highlightAt = this.clock.getElapsedTime() + HIGHLIGHT_EVERY;
    }

    starEvent(e: StarEvent) {
        const now = this.clock.getElapsedTime();
        const from = e.from != null ? this.people.get(e.from) : null;
        if (e.kind === "born") {
            if (this.starIndex.has(e.storyId) || this.starList.length >= MAX_STARS) return;
            const c = this.constellations.find((x) => x.slug === e.roomSlug);
            if (!c) return;
            const ri = c.index;
            const mine = e.from != null && e.from === this.meId;
            if (mine) this.mineIds.add(e.storyId);
            const data: SkyStar = { id: e.storyId, room: e.roomSlug, c: 0, lang: e.lang, nick: null, line: "", at: Date.now() };
            // 빈 자리(흐린 별)가 있으면 그 자리를 채움. 없으면 모양 둘레 빈 곳에
            let i = this.starList.findIndex((s) => s.room === ri && s.ghost);
            if (i >= 0) {
                const s = this.starList[i];
                this.starIndex.delete(s.id);
                Object.assign(s, { id: e.storyId, count: 0, mine, data, ghost: false });
            } else {
                const ang = Math.random() * Math.PI * 2;
                i = this.starList.length;
                this.starList.push({ id: e.storyId, pos: new THREE.Vector3(), count: 0, mine, room: ri, data, ghost: false, px: Math.cos(ang) * 1.2, py: Math.sin(ang) * 1.2 });
            }
            this.starIndex.set(e.storyId, i);
            c.starIds.push(e.storyId);
            this.placeConstellation(c);
            const dest = this.starList[i].pos;
            const start = from ? from.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)) : dest.clone();
            this.writeStar(i, now);
            (this.starGeo.attributes.position as THREE.BufferAttribute).setXYZ(i, start.x, start.y, start.z);
            if (from) this.pendingBorn.set(e.storyId, start);
            this.starGeo.setDrawRange(0, this.starList.length);
            this.flagStarAttrs();
            if (from) from.happyUntil = now + 2;
            this.spawnMeteor(false);
            return;
        }
        const i = this.starIndex.get(e.storyId);
        if (i == null) return;
        const st = this.starList[i];
        st.count = e.count;
        st.data.c = e.count;
        this.writeStar(i, (this.starGeo.attributes.aBorn as THREE.BufferAttribute).getX(i), now);
        if (e.kind === "glow") {
            (this.starGeo.attributes.aBorn as THREE.BufferAttribute).setX(i, now - 0.9);
            const start = from ? from.group.position.clone().add(new THREE.Vector3(0, 1.0, 0)) : this.horizonPoint().add(this.sky.position);
            this.addBeam(start, st.pos.clone().add(this.sky.position), st.mine ? 0xff9bb3 : 0xffd86b);
            if (from) this.hearts(from.id);
        }
        this.flagStarAttrs();
    }

    private horizonPoint(): THREE.Vector3 {
        const p = fromAngles(this.view / DEG + (Math.random() * 2 - 1) * 30, 4, DOME_R * 0.9);
        return new THREE.Vector3(p.x, p.y, p.z);
    }

    private addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number) {
        if (this.beams.length > 24) return;
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMe, color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
        spark.position.copy(from);
        spark.scale.set(0.9, 0.9, 1);
        this.scene.add(spark);
        this.beams.push({ line, spark, from: from.clone(), to: to.clone(), born: this.clock.getElapsedTime(), life: 1.8 });
    }

    private spawnMeteor(big: boolean) {
        if (this.opts.reduceMotion && !big) return;
        if (this.meteors.length >= 3) return;
        const base = this.view / DEG;
        // 보이는 하늘 여기저기서 (좌우 넓게, 높낮이도 섞어서)
        const p = big ? fromAngles(base + 12, 50, DOME_R * 1.05) : fromAngles(base + (Math.random() * 2 - 1) * 40, 22 + Math.random() * 30, DOME_R * 1.05);
        const start = new THREE.Vector3(p.x, p.y, p.z);
        // 왼쪽 아래 또는 오른쪽 아래로 (카메라 방향 기준), 기울기도 조금씩 다르게
        const side = big ? -1 : Math.random() < 0.5 ? -1 : 1;
        const right = new THREE.Vector3(Math.cos(this.view), 0, Math.sin(this.view));
        const vel = right.multiplyScalar(side * (big ? 12 : 13 + Math.random() * 10)).add(new THREE.Vector3(0, -(big ? 14 : 6 + Math.random() * 9), 0));
        const len = big ? 2.4 : 1.1;
        const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone().sub(vel.clone().multiplyScalar(len * 0.1))]);
        const mat = new THREE.LineBasicMaterial({ color: big ? 0xfff4d6 : 0xfff0c8, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        this.sky.add(line);
        {
            // 머리 빛: 작은 별똥별에도 달아서 잘 보이게
            const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMe, transparent: true, opacity: big ? 1 : 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
            const hsz = big ? 3.2 : 1.5;
            head.scale.set(hsz, hsz, 1);
            head.position.copy(start);
            this.sky.add(head);
            line.userData.head = head;
        }
        this.meteors.push({ line, vel, born: this.clock.getElapsedTime(), life: big ? 2.2 : 1.3, big });
        // 자주 떨어지니 작은 별똥별 소리는 가끔만
        if (big || Math.random() < 0.35) this.opts.onSfx(big ? "daily" : "meteor");
    }

    playDaily(): Promise<void> {
        this.spawnMeteor(true);
        return new Promise((resolve) => {
            this.dailyResolve = resolve;
            setTimeout(() => {
                if (this.dailyResolve === resolve) {
                    this.dailyResolve = null;
                    resolve();
                }
            }, 1900);
        });
    }

    // ---------- 사람(별 요정) ----------
    setMe(id: number | null) {
        this.meId = id;
        for (const p of this.people.values()) {
            this.applyLook(p);
            if (p.name) this.setName(p.id, p.name);
        }
    }

    syncMembers(you: MemberPublic, members: MemberPublic[]) {
        const keep = new Set<number>([you.id, ...members.map((m) => m.id)]);
        for (const id of [...this.people.keys()]) if (!keep.has(id)) this.removePerson(id);
        this.meId = you.id;
        for (const m of [you, ...members]) this.upsert(m, true);
        // 내가 언덕에 들어오며 인사 (다른 사람 화면에선 합류 때 흔듦)
        this.gesture(you.id, "wave");
    }

    // 몸짓 (서버에서 온 것. 내 것도 서버를 거쳐 옴)
    gesture(id: number, g: Gesture) {
        const p = this.people.get(id);
        if (!p) return;
        const now = this.clock.getElapsedTime();
        if (g === "wave") p.waveUntil = now + WAVE_SEC;
        else if (g === "lookup") p.lookUntil = now + 2.5;
        else if (g === "hug") p.happyUntil = now + 1.6;
        else if (g === "heart") this.hearts(id);
        else if (g === "pat") {
            p.patUntil = now + 1.6;
            p.happyUntil = now + 1.6;
        } else if (g === "tear") p.tearUntil = now + 2.2;
        else if (g === "joy") {
            p.joyUntil = now + 1.4;
            p.happyUntil = now + 1.4;
        }
        if (g !== "hug") this.showBubble(p, EMOTE_ICON[g]);
    }

    // 머리 위 그림 말풍선 (2.2초 동안 떠올랐다 사라짐)
    private showBubble(p: Person, icon: string) {
        if (p.bubble) {
            p.group.remove(p.bubble.sprite);
            p.bubble.sprite.material.map?.dispose();
            p.bubble.sprite.material.dispose();
        }
        const t = textTexture(icon, { size: 64, pad: 12 });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, depthTest: false }));
        sp.center.set(0.5, 0);
        sp.renderOrder = 6;
        p.group.add(sp);
        p.bubble = { sprite: sp, born: this.clock.getElapsedTime() };
    }

    // 소원 부두: 나무 판자 + 기둥 + 난간 + 끝의 등불 + 이름표
    private makeDock(): THREE.Group {
        const g = new THREE.Group();
        const y0 = DOCK_TOP - 0.03;
        const ang = Math.atan2(MOON_DIR.x, MOON_DIR.z);
        const W = WISH_DOCK.halfW * 2;
        const plankMat = new THREE.MeshBasicMaterial({ color: "#4a3324" });
        const plankMat2 = new THREE.MeshBasicMaterial({ color: "#3d2a1d" });
        const postMat = new THREE.MeshBasicMaterial({ color: "#2b1d14" });
        const at = (d: number) => new THREE.Vector3(WISH_SPOT.x + MOON_DIR.x * d, y0, WISH_SPOT.z + MOON_DIR.z * d);
        const side = (p: THREE.Vector3, k: number) => new THREE.Vector3(p.x + Math.cos(ang) * k, p.y, p.z - Math.sin(ang) * k);
        for (let d = -0.2, i = 0; d <= DOCK_LEN; d += 0.26, i++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, 0.22), i % 2 ? plankMat2 : plankMat);
            plank.position.copy(at(d));
            plank.rotation.y = ang;
            g.add(plank);
        }
        // 다리 기둥: 판자 아래로 땅까지. 양옆 난간 기둥도 겸함
        const rail: THREE.Vector3[][] = [[], []];
        for (const d of [0.3, 1.6, 2.9, 4.2, DOCK_LEN - 0.1]) {
            [-1, 1].forEach((sg, si) => {
                const p = side(at(d), (WISH_DOCK.halfW - 0.08) * sg);
                const bottom = Math.min(hillHeight(p.x, p.z), y0) - 0.6;
                const h = y0 + 0.55 - bottom;
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, h, 5), postMat);
                post.position.set(p.x, bottom + h / 2, p.z);
                g.add(post);
                rail[si].push(new THREE.Vector3(p.x, y0 + 0.52, p.z));
            });
        }
        // 난간: 기둥 머리를 잇는 가로대
        for (const pts of rail) {
            for (let i = 0; i + 1 < pts.length; i++) {
                const a = pts[i],
                    b = pts[i + 1];
                const len = a.distanceTo(b);
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), postMat);
                bar.position.copy(a).lerp(b, 0.5);
                bar.rotation.y = ang;
                g.add(bar);
            }
        }
        // 끝의 등불 기둥
        const end = at(DOCK_LEN);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.6, 6), postMat);
        pole.position.set(end.x, y0 + 0.8, end.z);
        g.add(pole);
        const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.lanternTex, transparent: true, depthWrite: false }));
        lamp.scale.set(0.62, 0.77, 1);
        lamp.position.set(end.x, y0 + 1.75, end.z);
        g.add(lamp);
        const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,190,110"), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        lampGlow.scale.set(3.2, 3.2, 1);
        lampGlow.position.copy(lamp.position);
        g.add(lampGlow);
        this.dockGlow = lampGlow;
        // 이름표: 멀리서도 읽히게 크게, 숨 쉬듯 깜빡여 눌러 보고 싶게
        const t = textTexture(`🏮 ${this.opts.wishLabel}`, { size: 44, color: "#ffe2b0", font: "700", pad: 20 });
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, opacity: 0.9 }));
        label.scale.set(0.66 * t.aspect, 0.66, 1);
        label.center.set(0.5, 0);
        label.position.set(end.x, y0 + 2.25, end.z);
        g.add(label);
        this.dockLabel = label;
        this.dockPoints = [
            at(0.2),
            at(DOCK_LEN * 0.33),
            at(DOCK_LEN * 0.66),
            at(DOCK_LEN),
            new THREE.Vector3(end.x, y0 + 1.2, end.z),
            new THREE.Vector3(end.x, y0 + 2.0, end.z),
            new THREE.Vector3(end.x, y0 + 2.6, end.z),
        ];
        return g;
    }

    flareTree() {
        this.tree.flare(this.clock.getElapsedTime());
    }

    // 부두 끝으로 걸어가기 (버튼·부두 누르기). 도착하면 달을 보고 onWishArrive
    goWish() {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        if (!me) {
            this.opts.onWishArrive();
            return;
        }
        // 누르자마자 카메라가 달(부두) 쪽으로 돌아 걸어가는 모습이 보이게. 이미 그쪽이면 안 돎
        const full = Math.PI * 2;
        let t = MOON_AZ * DEG;
        while (t - this.view > full / 2) t -= full;
        while (t - this.view < -full / 2) t += full;
        this.viewTarget = t;
        this.viewVel = 0;
        this.opts.onWishGo();
        // 이미 부두 위면 바로 끝으로, 아니면 입구를 거쳐 (바다 위로 질러가지 않게)
        if (onDock(me.pos.x, me.pos.y)) {
            this.walkDockEnd();
            return;
        }
        this.walkTo(WISH_SPOT.x, WISH_SPOT.z, false);
        this.wishPending = 1;
    }

    private walkDockEnd() {
        this.walkTo(WISH_SPOT.x + MOON_DIR.x * (DOCK_LEN - 0.45), WISH_SPOT.z + MOON_DIR.z * (DOCK_LEN - 0.45), false);
        this.wishPending = 2;
    }

    // 부두 끝 도착: 요정이 달을 올려다보고 소원 창
    private arriveWish(now: number) {
        this.wishPending = 0;
        const me = this.meId != null ? this.people.get(this.meId) : null;
        if (me) me.lookUntil = now + 3;
        this.opts.onWishArrive();
    }

    // 풍등 띄우기: 그 요정 머리 위에서 달 쪽으로 천천히 올라가며 작아짐
    launchLantern(id: number) {
        const p = this.people.get(id);
        if (!p) return;
        p.lookUntil = this.clock.getElapsedTime() + 3;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.lanternTex, transparent: true, depthWrite: false, opacity: 0 }));
        const start = p.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        s.position.copy(start);
        s.scale.set(0.7, 0.86, 1);
        this.scene.add(s);
        this.lanterns.push({ s, start, born: this.clock.getElapsedTime(), sway: Math.random() * 6 });
    }

    // 오늘 밤 소원들: 하늘 낮은 곳(달 둘레)에 떠 있는 작은 풍등. 누르면 그 소원
    setSkyWishes(items: { id: number }[]) {
        const keep = new Set(items.slice(0, 20).map((w) => w.id));
        this.skyWishes = this.skyWishes.filter((w) => {
            if (keep.has(w.id)) return true;
            this.sky.remove(w.s, w.g);
            w.s.material.dispose();
            w.g.material.dispose();
            return false;
        });
        for (const w of items.slice(0, 20)) {
            if (this.skyWishes.some((x) => x.id === w.id)) continue;
            // id 로 자리를 정해 새로고침해도 같은 자리
            const h = Math.sin(w.id * 12.9898) * 43758.5453;
            const r1 = h - Math.floor(h),
                r2 = (h * 7.13) % 1 < 0 ? ((h * 7.13) % 1) + 1 : (h * 7.13) % 1;
            const az = MOON_AZ + (r1 * 2 - 1) * WISH_HALF,
                el0 = 9 + r2 * 30; // 소원 하늘 칸 안, 달 둘레에만 (옆 별자리와 안 섞이게)
            // 달과 그 아래 이름표 자리는 비켜 감
            const el = Math.abs(az - MOON_AZ) < 7 && el0 > MOON_ELEV - 10 && el0 < MOON_ELEV + 5 ? (el0 < MOON_ELEV - 3 ? MOON_ELEV - 13 : MOON_ELEV + 8) : el0;
            const p = fromAngles(az, el, DOME_R * 0.92);
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.lanternTex, transparent: true, depthWrite: false, opacity: 0.9 }));
            s.position.set(p.x, p.y, p.z);
            s.scale.set(3.4, 4.2, 1);
            // 뒤에 따뜻한 빛: 멀리서도 풍등인 줄 알게, 빌어 주면 확 밝아짐
            const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,185,105"), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
            g.position.copy(s.position);
            g.scale.set(9, 9, 1);
            this.sky.add(g, s);
            this.skyWishes.push({ id: w.id, s, g, phase: r1 * 6.28, flare: 0 });
        }
    }

    // 빌어 준 풍등이 잠깐 환해짐
    flareWish(id: number) {
        const w = this.skyWishes.find((x) => x.id === id);
        if (w) w.flare = this.clock.getElapsedTime();
    }

    // 그림자 요정 수 맞추기 (진짜 사람이 늘면 줄임)
    setGhosts(n: number) {
        const seats = [200, 340, 150, 30].map((deg) => deg * DEG); // 불 양옆·뒤 (카메라와 불 사이는 피함)
        n = Math.max(0, Math.min(n, seats.length));
        while (this.ghosts.length > n) {
            const g = this.ghosts.pop()!;
            this.scene.remove(g.s);
            g.s.material.dispose();
        }
        while (this.ghosts.length < n) {
            const i = this.ghosts.length;
            const pal = PALETTES[(i * 3 + 1) % PALETTES.length];
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(pal).idle, transparent: true, opacity: 0, depthWrite: false, color: 0xb8c4ff }));
            s.scale.set(1.15, 1.15, 1);
            s.center.set(0.5, 0.1);
            const r = FIRE_KEEP_OUT + 0.9;
            const x = FIRE_POS.x + Math.cos(seats[i]) * r,
                z = FIRE_POS.z + Math.sin(seats[i]) * r;
            s.position.set(x, hillHeight(x, z) + 0.05, z);
            this.scene.add(s);
            this.ghosts.push({ s, phase: Math.random() * 6 });
        }
    }

    // 내 요정의 감정 표현 (바로 보여 주고, 서버로도 보냄)
    emote(g: Gesture) {
        if (this.meId == null) return;
        const now = performance.now();
        if (now - this.lastEmote < 1500) return; // 서버 간격 제한과 맞춤
        this.lastEmote = now;
        this.gesture(this.meId, g);
        this.opts.onGesture(g);
    }

    // 마음 보내기: 보낸 요정에서 받는 요정으로 하트가 날아가고, 받은 요정 둘레에 하트가 퍼짐
    gift(from: number, to: number) {
        const a = this.people.get(from),
            b = this.people.get(to);
        if (!a || !b) return;
        a.happyUntil = this.clock.getElapsedTime() + 1.2;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, opacity: 1, depthWrite: false, depthTest: false }));
        sp.scale.set(0.34, 0.34, 1);
        sp.renderOrder = 6;
        this.scene.add(sp);
        this.gifts.push({ sprite: sp, from, to, born: this.clock.getElapsedTime() });
    }

    // 내 요정이 손 흔듦 (바로 보여 주고, 서버로도 보냄)
    waveMe() {
        if (this.meId == null) return;
        this.gesture(this.meId, "wave");
        this.opts.onGesture("wave");
    }

    applyTick(moved: [number, number, number, Pose][], joined: MemberPublic[], left: number[]) {
        for (const m of joined) {
            this.upsert(m, true);
            // 새로 온 사람은 한 번 손 흔들며 인사
            this.gesture(m.id, "wave");
        }
        for (const id of left) this.removePerson(id);
        for (const [id, x, z, p] of moved) {
            const person = this.people.get(id);
            if (!person || id === this.meId) continue;
            person.target.set(x, z);
            person.pose = p;
        }
    }

    // 방향키: 누르는 동안만 매 프레임 움직임 (루프에서 호출)
    private stepKeys(dt: number, now: number) {
        if (this.meId == null) return;
        const me = this.people.get(this.meId);
        if (!me) return;
        let dx = 0,
            dz = 0;
        if (this.keys.has("ArrowLeft") || this.keys.has("a")) dx -= 1;
        if (this.keys.has("ArrowRight") || this.keys.has("d")) dx += 1;
        if (this.keys.has("ArrowUp") || this.keys.has("w")) dz += 1;
        if (this.keys.has("ArrowDown") || this.keys.has("s")) dz -= 1;
        if (dx === 0 && dz === 0) {
            if (this.keyWalking) {
                this.keyWalking = false;
                me.target.copy(me.pos);
                this.opts.onWalk(Math.round(me.pos.x * 10) / 10, Math.round(me.pos.y * 10) / 10, false);
            }
            return;
        }
        const len = Math.hypot(dx, dz);
        // 카메라 기준 좌우/앞뒤
        const right = new THREE.Vector2(Math.cos(this.view), Math.sin(this.view));
        const fwd = new THREE.Vector2(Math.sin(this.view), -Math.cos(this.view));
        const step = (KEY_SPEED * dt) / len;
        const nx = THREE.MathUtils.clamp(me.pos.x + right.x * dx * step + fwd.x * dz * step, -HILL_HALF_W, HILL_HALF_W);
        const nz = THREE.MathUtils.clamp(me.pos.y + right.y * dx * step + fwd.y * dz * step, -HILL_HALF_D, HILL_HALF_D);
        me.pos.set(nx, nz);
        me.target.copy(me.pos);
        me.pose = "stand";
        me.walkUntil = now + 0.12;
        me.bob += dt * 10;
        this.keyWalking = true;
        if (performance.now() - this.lastKeySend >= KEY_SEND_MS) {
            this.lastKeySend = performance.now();
            this.opts.onWalk(Math.round(nx * 10) / 10, Math.round(nz * 10) / 10, true);
        }
    }

    hearts(id: number) {
        const p = this.people.get(id);
        if (!p) return;
        const now = this.clock.getElapsedTime();
        p.happyUntil = now + 1.6;
        for (let k = 0; k < 3; k++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, opacity: 0.95, depthWrite: false }));
            sp.scale.set(0.26, 0.26, 1);
            sp.position.set((Math.random() - 0.5) * 0.4, 1.0 + k * 0.05, 0);
            p.group.add(sp);
            p.hearts.push({ sprite: sp, born: now + k * 0.18 });
        }
    }

    private upsert(m: MemberPublic, snap: boolean) {
        let p = this.people.get(m.id);
        if (!p) {
            const group = new THREE.Group();
            const pal = m.id === this.meId ? ME_PALETTE : PALETTES[m.id % PALETTES.length];
            const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(pal).idle, transparent: true, depthWrite: false }));
            body.scale.set(1.15, 1.15, 1);
            body.center.set(0.5, 0.1);
            body.position.y = 0.05;
            group.add(body);
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: this.glowOther, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
            glow.rotation.x = -Math.PI / 2;
            glow.position.y = 0.03;
            group.add(glow);
            this.scene.add(group);
            const now = this.clock.getElapsedTime();
            p = {
                id: m.id,
                group,
                body,
                glow,
                pal,
                target: new THREE.Vector2(m.x, m.z),
                pos: new THREE.Vector2(m.x, m.z),
                pose: m.p,
                bob: Math.random() * 6.28,
                nextBlink: now + 2 + Math.random() * 4,
                blinkUntil: 0,
                lookUntil: 0,
                happyUntil: 0,
                walkUntil: 0,
                waveUntil: 0,
                hearts: [],
                name: null,
                tag: null,
                tagAspect: 1,
                tagLift: 0,
                joyUntil: 0,
                patUntil: 0,
                tearUntil: 0,
                bubble: null,
            };
            this.people.set(m.id, p);
            this.applyLook(p);
            const name = m.n ?? this.pendingNames.get(m.id) ?? null;
            this.pendingNames.delete(m.id);
            if (name) this.setName(m.id, name);
        } else {
            if (m.n && m.n !== p.name) this.setName(m.id, m.n);
            p.target.set(m.x, m.z);
            if (snap) p.pos.set(m.x, m.z);
            p.pose = m.p;
        }
        this.place(p);
    }

    private tex(pal: Palette): Record<CreatureKind, THREE.Texture> {
        let t = this.texCache.get(pal.body);
        if (!t) {
            t = Object.fromEntries(CREATURE_KINDS.map((k) => [k, creatureTexture(k, pal)])) as Record<CreatureKind, THREE.Texture>;
            this.texCache.set(pal.body, t);
        }
        return t;
    }

    // 별명표끼리 화면에서 겹치면 뒤쪽(먼) 것을 위로 비켜 올림. 가까운 사람 이름표가 제자리, 부드럽게 움직임
    private layoutTags(dt: number) {
        const H = this.canvas.clientHeight || window.innerHeight;
        const tanHalf = Math.tan((this.camera.fov * DEG) / 2);
        const v = new THREE.Vector3();
        const items: { p: Person; x: number; y: number; w: number; h: number; ppw: number; dist: number }[] = [];
        for (const p of this.people.values()) {
            if (!p.tag) continue;
            v.set(p.group.position.x, p.group.position.y + TAG_Y, p.group.position.z);
            const dist = v.distanceTo(this.camera.position);
            v.project(this.camera);
            if (v.z > 1) continue;
            const ppw = H / (2 * dist * tanHalf); // 이 깊이에서 월드 1 이 몇 px
            // 카메라 바로 앞(부두에서 다가갔을 때 등) 이름표가 화면을 가로지르지 않게 화면 높이 상한
            const k = Math.min(1, TAG_MAX_PX / (TAG_H * ppw));
            p.tag.scale.set(TAG_H * k * p.tagAspect, TAG_H * k, 1);
            const h = TAG_H * k * ppw,
                w = h * p.tagAspect * 0.92 + 4; // 글자 둘레 여백은 조금 빼고, 옆 이름표와 틈 4px
            items.push({ p, x: ((v.x + 1) / 2) * (this.canvas.clientWidth || window.innerWidth), y: ((1 - v.y) / 2) * H, w, h, ppw, dist });
        }
        items.sort((a, b) => a.dist - b.dist);
        const placed: { l: number; r: number; t: number; b: number }[] = [];
        for (const it of items) {
            const l = it.x - it.w / 2,
                r = it.x + it.w / 2;
            let bottom = it.y; // 이름표 아래끝(화면 y, 아래로 갈수록 큼)
            for (let k = 0; k < 12; k++) {
                const hit = placed.find((q) => l < q.r && r > q.l && bottom > q.t && bottom - it.h < q.b);
                if (!hit) break;
                bottom = hit.t - 1;
            }
            placed.push({ l, r, t: bottom - it.h, b: bottom });
            const want = (it.y - bottom) / it.ppw;
            it.p.tagLift += (want - it.p.tagLift) * Math.min(1, dt * 8);
            if (Math.abs(want - it.p.tagLift) < 0.002) it.p.tagLift = want;
            it.p.tag!.position.y = TAG_Y + it.p.tagLift;
        }
    }

    // 머리 위 별명표. 내 것은 별빛 색, 다른 사람은 흰색 조금 흐리게
    setName(id: number, name: string | null) {
        const p = this.people.get(id);
        if (!p) {
            this.pendingNames.set(id, name);
            return;
        }
        p.name = name;
        if (p.tag) {
            p.group.remove(p.tag);
            p.tag.material.map?.dispose();
            p.tag.material.dispose();
            p.tag = null;
        }
        if (!name) return;
        const me = id === this.meId;
        const t = textTexture(name, { size: 40, color: me ? "#ffe9a8" : "#ffffff", font: me ? "700" : "500", pad: 20 });
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, depthTest: false, opacity: me ? 1 : 0.75 }));
        const h = TAG_H;
        tag.scale.set(h * t.aspect, h, 1);
        p.tagAspect = t.aspect;
        tag.center.set(0.5, 0);
        tag.position.y = TAG_Y + p.tagLift;
        tag.renderOrder = 5;
        p.group.add(tag);
        p.tag = tag;
    }

    private applyLook(p: Person) {
        const me = p.id === this.meId;
        p.pal = me ? ME_PALETTE : PALETTES[p.id % PALETTES.length];
        const gm = p.glow.material as THREE.MeshBasicMaterial;
        gm.map = me ? this.glowMe : this.glowOther;
        gm.opacity = me ? 0.55 : 0.25;
        gm.needsUpdate = true;
        p.glow.scale.setScalar(me ? 1.5 : 1);
    }

    private removePerson(id: number) {
        const p = this.people.get(id);
        if (!p) return;
        this.scene.remove(p.group);
        p.body.material.dispose();
        (p.glow.material as THREE.Material).dispose();
        p.glow.geometry.dispose();
        for (const h of p.hearts) h.sprite.material.dispose();
        if (p.tag) {
            p.tag.material.map?.dispose();
            p.tag.material.dispose();
        }
        if (p.bubble) {
            p.bubble.sprite.material.map?.dispose();
            p.bubble.sprite.material.dispose();
        }
        this.people.delete(id);
        this.pendingNames.delete(id);
    }

    private place(p: Person) {
        p.group.position.set(p.pos.x, groundY(p.pos.x, p.pos.y), p.pos.y);
    }

    // ---------- 입력 ----------
    private onDown = (e: PointerEvent) => {
        this.lastInputAt = this.clock.getElapsedTime();
        // 섬(땅)이나 내 요정 근처를 잡았으면 걷기, 아니면 하늘 돌리기
        const rect = this.canvas.getBoundingClientRect();
        const g0 = this.groundAt(e.clientX, e.clientY);
        const mode = this.meId != null && (g0 || this.meTapped(e.clientX, e.clientY, rect, 48)) ? "walk" : "look";
        const me = this.meId != null ? this.people.get(this.meId) : null;
        this.pointer = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, startView: this.view, lastX: e.clientX, lastT: performance.now(), vel: 0, mode, g0, me0: me ? { x: me.pos.x, z: me.pos.y } : null };
        if (mode === "look") {
            this.viewTarget = null;
            this.viewVel = 0;
        }
        try {
            this.canvas.setPointerCapture(e.pointerId);
        } catch {}
    };
    private onMove = (e: PointerEvent) => {
        if (!this.pointer || this.pointer.id !== e.pointerId) return;
        const dx = e.clientX - this.pointer.x,
            dy = e.clientY - this.pointer.y;
        if (!this.pointer.moved && Math.hypot(dx, dy) < 8) return;
        if (!this.pointer.moved && this.pointer.mode === "look") this.opts.onLookDrag();
        this.pointer.moved = true;
        if (this.pointer.mode === "walk") {
            // 잡은 지점에서 손가락이 움직인 만큼 요정이 따라감 (요정을 잡고 끄는 느낌). 섬 밖이면 마지막 자리 유지
            const g = this.groundAt(e.clientX, e.clientY);
            if (g) {
                const p = this.pointer;
                if (!p.g0) p.g0 = g;
                const base = p.me0 ?? g;
                const tx = THREE.MathUtils.clamp(base.x + (g.x - p.g0.x), -HILL_HALF_W, HILL_HALF_W);
                const tz = THREE.MathUtils.clamp(base.z + (g.z - p.g0.z), -HILL_HALF_D, HILL_HALF_D);
                this.walkTo(tx, tz, true);
                this.lastInputAt = this.clock.getElapsedTime();
            }
            return;
        }
        this.dragging = true;
        const w = this.canvas.clientWidth || 390;
        // 화면 폭만큼 끌면 화각만큼 돎 (손에 붙어 도는 느낌)
        const hfov = hfovOf(this.camera.fov, this.camera.aspect) * DEG;
        this.view = this.pointer.startView - (dx / w) * hfov;
        const nowT = performance.now();
        const dtMs = Math.max(1, nowT - this.pointer.lastT);
        const v = (-(e.clientX - this.pointer.lastX) / w) * hfov * (1000 / dtMs);
        this.pointer.vel = this.pointer.vel * 0.6 + v * 0.4;
        this.pointer.lastX = e.clientX;
        this.pointer.lastT = nowT;
        this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget + dy * 0.0006, -0.08, 0.16);
    };
    private onUp = (e: PointerEvent) => {
        const p = this.pointer;
        this.pointer = null;
        if (!p) return;
        this.lastInputAt = this.clock.getElapsedTime();
        if (p.moved && p.mode === "walk") {
            const me = this.people.get(this.meId ?? -1);
            if (me) this.opts.onWalk(Math.round(me.target.x * 10) / 10, Math.round(me.target.y * 10) / 10, false);
            return;
        }
        if (p.moved) {
            this.dragging = false;
            // 놓은 속도로 조금 더 돎 (관성)
            this.viewVel = THREE.MathUtils.clamp(performance.now() - p.lastT < 80 ? p.vel : 0, -4, 4);
            return;
        }
        this.tap(e.clientX, e.clientY);
    };
    private onCancel = () => {
        this.pointer = null;
        this.dragging = false;
    };
    private onTouchEnd = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
    };
    private static isTyping(e: KeyboardEvent): boolean {
        const tag = (e.target as HTMLElement | null)?.tagName;
        return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
    }
    private onKey = (e: KeyboardEvent) => {
        if (HillScene.isTyping(e)) return;
        this.lastInputAt = this.clock.getElapsedTime();
        if (e.key === "ArrowLeft" && e.shiftKey) this.goTo(this.index - 1);
        else if (e.key === "ArrowRight" && e.shiftKey) this.goTo(this.index + 1);
        else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(e.key)) this.keys.add(e.key);
        else return;
        e.preventDefault();
    };
    private onKeyUp = (e: KeyboardEvent) => {
        this.keys.delete(e.key);
        if (e.key === "Shift") {
            // Shift+화살표 뒤 화살표만 떼는 경우 대비
            for (const k of ["ArrowLeft", "ArrowRight"]) this.keys.delete(k);
        }
    };
    private onBlur = () => {
        this.keys.clear();
    };

    private tap(cx: number, cy: number) {
        const rect = this.canvas.getBoundingClientRect();
        const nx = ((cx - rect.left) / rect.width) * 2 - 1;
        const ny = -((cy - rect.top) / rect.height) * 2 + 1;
        // 내 요정을 누르면 손 흔들기
        if (this.meTapped(cx, cy, rect)) {
            this.waveMe();
            return;
        }
        // 다른 요정을 누르면 마음 보내기
        const other = this.otherTapped(cx, cy, rect);
        if (other != null && this.meId != null) {
            const now = performance.now();
            if (now - this.lastEmote >= 1500) {
                this.lastEmote = now;
                this.gift(this.meId, other);
                this.opts.onGift(other);
            }
            return;
        }
        // 소원 부두를 누르면 부두 끝으로 걸어감
        if (this.nearScreen(this.dockPoints, cx, cy, rect, 48)) {
            this.goWish();
            return;
        }
        // 크리스마스트리: 불빛이 반짝 (같이 있는 사람들에게도)
        if (this.nearScreen(this.tree.hitPoints(), cx, cy, rect, 40)) {
            this.flareTree();
            this.opts.onTreeTap();
            return;
        }
        // 하늘에 뜬 오늘 밤 소원 풍등
        const wishHit = this.skyWishAt(cx, cy, rect);
        if (wishHit != null) {
            this.opts.onWishTap(wishHit);
            return;
        }
        // 땅(섬)을 누르면 거기로 걸어감. 별·별자리 판정보다 먼저 (폰에서 요정 근처를 눌러도 별자리로 안 넘어가게)
        const ground = this.groundAt(cx, cy);
        if (ground) {
            this.walkTo(ground.x, ground.z, false);
            return;
        }
        const hit = this.nearestStar(nx, ny, rect.width, rect.height, 28);
        if (hit != null) {
            const st = this.starList[hit];
            if (st.room !== this.index) {
                // 다른 별자리의 별: 그 별자리를 고르고 그 별을 밝힘
                this.goTo(st.room);
                if (!st.ghost) this.highlightById(st.id);
                return;
            }
            if (st.ghost) return;
            this.highlightById(st.id);
            this.opts.onStarTap(st.id);
            return;
        }
        // 별자리 칸(이름표 포함)을 누르면 고르기
        const cell = this.cellAt(nx, ny, rect.width, rect.height);
        if (cell != null && cell !== this.index) this.goTo(cell);
    }

    // 화면 좌표 → 섬 위 좌표 (섬 밖이면 null)
    private groundAt(cx: number, cy: number): { x: number; z: number } | null {
        const rect = this.canvas.getBoundingClientRect();
        const nx = ((cx - rect.left) / rect.width) * 2 - 1;
        const ny = -((cy - rect.top) / rect.height) * 2 + 1;
        this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
        const inter = this.ray.intersectObject(this.ground, false);
        if (!inter.length) return null;
        const pt = inter[0].point;
        return { x: THREE.MathUtils.clamp(pt.x, -HILL_HALF_W, HILL_HALF_W), z: THREE.MathUtils.clamp(pt.z, -HILL_HALF_D, HILL_HALF_D) };
    }

    // 내 요정 근처를 눌렀나 (화면에서 px 안)
    private nearScreen(points: THREE.Vector3[], cx: number, cy: number, rect: DOMRect, px: number): boolean {
        const v = new THREE.Vector3();
        return points.some((p) => {
            v.copy(p).project(this.camera);
            if (v.z > 1) return false;
            return Math.hypot(cx - (rect.left + ((v.x + 1) / 2) * rect.width), cy - (rect.top + ((1 - v.y) / 2) * rect.height)) < px;
        });
    }

    private skyWishAt(cx: number, cy: number, rect: DOMRect): number | null {
        let best: number | null = null,
            bestD = 52;
        const v = new THREE.Vector3();
        for (const w of this.skyWishes) {
            v.copy(w.s.position).add(this.sky.position).project(this.camera);
            if (v.z > 1) continue;
            const d = Math.hypot(cx - (rect.left + ((v.x + 1) / 2) * rect.width), cy - (rect.top + ((1 - v.y) / 2) * rect.height));
            if (d < bestD) {
                bestD = d;
                best = w.id;
            }
        }
        return best;
    }

    // 내 요정이 아닌 가장 가까운 요정 (손가락 36px 안)
    private otherTapped(cx: number, cy: number, rect: DOMRect, px = 36): number | null {
        let best: number | null = null,
            bestD = px;
        const v = new THREE.Vector3();
        for (const p of this.people.values()) {
            if (p.id === this.meId) continue;
            v.set(p.group.position.x, p.group.position.y + 0.55, p.group.position.z).project(this.camera);
            if (v.z > 1) continue;
            const d = Math.hypot(cx - (rect.left + ((v.x + 1) / 2) * rect.width), cy - (rect.top + ((1 - v.y) / 2) * rect.height));
            if (d < bestD) {
                bestD = d;
                best = p.id;
            }
        }
        return best;
    }

    private meTapped(cx: number, cy: number, rect: DOMRect, px = 36): boolean {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        if (!me) return false;
        const v = new THREE.Vector3(me.group.position.x, me.group.position.y + 0.55, me.group.position.z).project(this.camera);
        if (v.z > 1) return false;
        const sx = rect.left + ((v.x + 1) / 2) * rect.width,
            sy = rect.top + ((1 - v.y) / 2) * rect.height;
        return Math.hypot(cx - sx, cy - sy) < px;
    }

    // 걷기: 누르면 한 번 보냄, 끌면 150ms 마다 보냄. 발밑에 목표 표시
    private walkTo(x: number, z: number, dragging: boolean) {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        if (!me) return;
        this.wishPending = 0;
        me.target.set(x, z);
        me.pose = "stand";
        this.showWalkMark(x, z);
        const rx = Math.round(x * 10) / 10,
            rz = Math.round(z * 10) / 10;
        if (!dragging) {
            this.opts.onGroundTap(rx, rz);
            return;
        }
        if (performance.now() - this.lastWalkSend >= KEY_SEND_MS) {
            this.lastWalkSend = performance.now();
            this.opts.onWalk(rx, rz, true);
        }
    }

    private showWalkMark(x: number, z: number) {
        if (!this.walkMark) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a6, transparent: true, opacity: 0.8, depthWrite: false }));
            m.rotation.x = -Math.PI / 2;
            this.scene.add(m);
            this.walkMark = m;
        }
        this.walkMark.position.set(x, groundY(x, z) + 0.04, z);
        this.walkMark.visible = true;
        this.walkMarkUntil = this.clock.getElapsedTime() + 1.2;
    }

    // 누른 곳에 있는 별자리 칸. 화면 밖·옆으로 크게 일그러진 칸은 빼고(넓은 PC 화면에서 소원 하늘을 눌러도
    // 멀리 있는 별자리로 넘어가던 문제), 겹치면 중심이 가장 가까운 칸
    private cellAt(nx: number, ny: number, w: number, h: number): number | null {
        const v = new THREE.Vector3();
        let best: number | null = null,
            bestD = Infinity;
        for (const c of this.constellations) {
            const center = starPoint(c.cell, 0, 0, c.scale);
            v.set(center.x, center.y, center.z).add(this.sky.position).project(this.camera);
            if (v.z > 1 || Math.abs(v.x) > 1.05) continue;
            const edge = starPoint(c.cell, 1, 0, c.scale);
            const ev = new THREE.Vector3(edge.x, edge.y, edge.z).add(this.sky.position).project(this.camera);
            if (ev.z > 1) continue;
            const rx = Math.min(0.45, Math.abs(ev.x - v.x) * 1.25),
                ry = rx * (w / h) * 1.15 + 0.03;
            if (Math.abs(nx - v.x) < rx && ny < v.y + ry && ny > v.y - ry * 1.9) {
                const d = Math.hypot(nx - v.x, ny - v.y);
                if (d < bestD) {
                    bestD = d;
                    best = c.index;
                }
            }
        }
        // 소원 하늘(달 둘레)도 한 칸으로: 누르면 그쪽으로 돎
        const mc = fromAngles(MOON_AZ, MOON_ELEV, DOME_R);
        v.set(mc.x, mc.y, mc.z).add(this.sky.position).project(this.camera);
        if (v.z < 1 && Math.abs(v.x) <= 1.05) {
            const me = fromAngles(MOON_AZ + WISH_HALF * 0.8, MOON_ELEV, DOME_R);
            const ev = new THREE.Vector3(me.x, me.y, me.z).add(this.sky.position).project(this.camera);
            const rx = Math.min(0.45, Math.abs(ev.x - v.x));
            const ry = rx * (w / h) * 1.2 + 0.05;
            if (ev.z < 1 && Math.abs(nx - v.x) < rx && Math.abs(ny - v.y) < ry) {
                const d = Math.hypot(nx - v.x, ny - v.y);
                if (d < bestD) best = WISH_INDEX;
            }
        }
        return best;
    }

    // 확인용: 내 요정 위치
    mePos(): { x: number; z: number } | null {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        return me ? { x: me.pos.x, z: me.pos.y } : null;
    }

    // 확인용: 내 요정의 화면 좌표
    meScreen(): { x: number; y: number } | null {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        if (!me) return null;
        const rect = this.canvas.getBoundingClientRect();
        const v = new THREE.Vector3(me.group.position.x, me.group.position.y + 0.55, me.group.position.z).project(this.camera);
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    }

    // 확인용: 카메라 방위각(도)
    viewAz(): number {
        return this.view / DEG;
    }

    starScreenPositions(): { id: number; x: number; y: number; ghost: boolean; room: number }[] {
        const rect = this.canvas.getBoundingClientRect();
        const v = new THREE.Vector3();
        const out: { id: number; x: number; y: number; ghost: boolean; room: number }[] = [];
        for (const s of this.starList) {
            v.copy(s.pos).add(this.sky.position).project(this.camera);
            if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
            out.push({ id: s.id, x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, ghost: s.ghost, room: s.room });
        }
        return out;
    }

    // 디자인 확인용: 별자리 칸과 이름
    cells(): { zodiac: string; slug: string | null; title: string | null; az: number; elev: number; half: number; stars: number }[] {
        return this.constellations.map((c) => ({ zodiac: c.shape.name, slug: c.slug, title: c.title, ...c.cell, stars: c.starIds.length }));
    }

    private nearestStar(nx: number, ny: number, w: number, h: number, px: number): number | null {
        const v = new THREE.Vector3();
        let best: number | null = null,
            bestD = (px * 2) / Math.min(w, h);
        for (let i = 0; i < this.starList.length; i++) {
            const s = this.starList[i];
            v.copy(s.pos).add(this.sky.position).project(this.camera);
            if (v.z > 1) continue;
            const d = Math.hypot((v.x - nx) * (w / Math.min(w, h)), (v.y - ny) * (h / Math.min(w, h)));
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    // ---------- 루프 ----------
    private resize = () => {
        const w = this.canvas.clientWidth || window.innerWidth;
        const h = this.canvas.clientHeight || window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.portrait = w < h;
        this.camera.fov = this.portrait ? 76 : 58;
        this.camera.updateProjectionMatrix();
        this.applyLabelVisibility();
    };

    // 수평선(바다 끝, 높이 0)의 화면 세로 위치를 %로 .hill-wrap 의 --hill-horizon 에 씀. 카드·안내는 그 위에 붙어 어떤 화면 크기에서도 섬을 안 가림
    private exportHorizon() {
        const c = this.camera.position;
        const v = new THREE.Vector3(c.x + Math.sin(this.view) * 300, 0, c.z - Math.cos(this.view) * 300).project(this.camera);
        const pct = Math.round(((1 - v.y) / 2) * 1000) / 10;
        if (!Number.isFinite(pct) || Math.abs(pct - this.horizonPct) < 0.3) return;
        this.horizonPct = pct;
        this.canvas.parentElement?.style.setProperty("--hill-horizon", `${pct}%`);
    }

    // 세로 화면에선 별자리 이름표(이름·주제)를 안 그림. 그 자리에 문장 카드가 옴
    private applyLabelVisibility() {
        for (const c of this.constellations) c.label.visible = c.sub.visible = !this.portrait;
    }
    private onVis = () => {
        this.visible = document.visibilityState !== "hidden";
        if (this.visible) this.loop();
    };

    private loop = () => {
        if (this.disposed || !this.visible) return;
        this.raf = requestAnimationFrame(this.loop);
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const now = this.clock.getElapsedTime();
        this.starMat.uniforms.uTime.value = now;
        this.bgMat.uniforms.uTime.value = now;

        // 카메라: 제자리에서 돌아봄. ‹ › 는 목표까지, 손을 놓으면 관성으로 조금 더
        if (!this.dragging) {
            if (this.viewTarget != null) {
                this.view += (this.viewTarget - this.view) * Math.min(1, dt * 5);
                if (Math.abs(this.viewTarget - this.view) < 0.002) {
                    this.view = this.viewTarget;
                    this.viewTarget = null;
                }
            } else if (Math.abs(this.viewVel) > 0.002) {
                this.view += this.viewVel * dt;
                this.viewVel *= Math.pow(0.12, dt);
            }
        }
        if (this.viewTarget == null) {
            const near = this.nearestToView();
            if (near !== this.index) this.select(near);
        }
        this.pitch += (this.pitchTarget - this.pitch) * Math.min(1, dt * 6);
        // 카메라: 모닥불 둘레를 돌며 불 건너편 하늘을 봄 → 어느 쪽을 봐도 모닥불과 그쪽 사람들이 앞에 보임
        // 정면(view 0)일 때 자리는 예전과 같음(SKY_ORIGIN). 하늘은 카메라 자리를 따라옴
        const bx = FIRE_POS.x - Math.sin(this.view) * ORBIT_R,
            bz = FIRE_POS.z + Math.cos(this.view) * ORBIT_R;
        this.sky.position.set(bx - SKY_ORIGIN.x, 0, bz - SKY_ORIGIN.z);
        // 세로(폰)에선 카메라를 불 쪽으로 당겨 요정이 크게 보임. 내 요정이 부두 위에 서면 더 다가감
        const meP = this.meId != null ? this.people.get(this.meId) : null;
        const wantNear = meP && onDock(meP.pos.x, meP.pos.y) ? 1 : 0;
        this.dockNear += (wantNear - this.dockNear) * Math.min(1, dt * 1.6);
        const fwd = (this.portrait ? PORTRAIT_CAM_FWD : 0) + this.dockNear * DOCK_CAM_FWD;
        const cx = bx + Math.sin(this.view) * fwd,
            cz = bz - Math.cos(this.view) * fwd;
        this.camera.position.set(cx, CAM_Y + this.pitch * 2, cz);
        const lookY = CAM_Y + 20 * Math.tan(SKY_V_CENTER * DEG) + this.pitch * 14 - this.dockNear * 1.2;
        this.camera.lookAt(cx + Math.sin(this.view) * 20, lookY, cz - Math.cos(this.view) * 20);

        this.scenery.update(now, dt, this.view);
        this.exportHorizon();
        this.tree.update(now, this.view);
        if (this.snow) {
            this.snow.position.set(cx, 0, cz);
            (this.snow.material as THREE.ShaderMaterial).uniforms.uTime.value = now;
        }

        // 고른 별자리가 커지고 나머지는 작아지는 움직임
        for (const c of this.constellations) {
            if (Math.abs(c.scale - c.scaleTarget) > 0.002) {
                c.scale += (c.scaleTarget - c.scale) * Math.min(1, dt * 6);
                if (Math.abs(c.scale - c.scaleTarget) <= 0.002) c.scale = c.scaleTarget;
                this.placeConstellation(c);
            }
        }

        // 자동으로 별 하나씩 밝히기
        if (!this.dragging && now > this.highlightAt && this.constellations.length) {
            const wait = this.advanceHighlight();
            this.highlightAt = now + (wait === HIGHLIGHT_EVERY && this.constellations[this.index]?.starIds.length === 0 ? EMPTY_WAIT : wait);
        }

        this.stepKeys(dt, now);
        if (this.walkMark && this.walkMark.visible) {
            const left = this.walkMarkUntil - now;
            if (left <= 0) this.walkMark.visible = false;
            else (this.walkMark.material as THREE.MeshBasicMaterial).opacity = Math.min(0.8, left * 1.5);
        }

        // 요정들
        for (const p of this.people.values()) {
            const d = p.pos.distanceTo(p.target);
            let kind: CreatureKind = "idle";
            const walking = d > 0.03 || now < p.walkUntil;
            if (walking) {
                if (d > 0.03) {
                    const step = Math.min(d, WALK_SPEED * (this.wishPending && p.id === this.meId ? WISH_RUN : 1) * dt);
                    p.pos.lerp(p.target, step / d);
                    p.bob += dt * 10;
                }
                kind = Math.sin(p.bob) > 0 ? "walk1" : "walk2";
            } else {
                if (now > p.nextBlink) {
                    p.blinkUntil = now + 0.14;
                    p.nextBlink = now + 2.5 + Math.random() * 4;
                }
                if (now < p.waveUntil) kind = Math.sin(now * 11) > 0 ? "wave1" : "wave2";
                else if (now < p.tearUntil) kind = "sad";
                else if (now < p.happyUntil) kind = "happy";
                else if (now < p.blinkUntil) kind = "blink";
                else if (now < p.lookUntil) kind = "lookup";
            }
            const tex = this.tex(p.pal)[kind];
            const mat = p.body.material as THREE.SpriteMaterial;
            if (mat.map !== tex) {
                mat.map = tex;
                mat.needsUpdate = true;
            }
            // 모닥불 가까울수록 따뜻하게 일렁이고, 멀면 달빛처럼 푸르스름
            const fireNear = THREE.MathUtils.clamp(1 - (Math.hypot(p.pos.x - FIRE_POS.x, p.pos.y - FIRE_POS.z) - 1.4) / 5.5, 0, 1);
            const fl = 0.93 + (this.scenery.fireFlicker - 0.92) * 0.9;
            mat.color.setRGB(THREE.MathUtils.lerp(0.78, fl, fireNear), THREE.MathUtils.lerp(0.82, fl * 0.9, fireNear), THREE.MathUtils.lerp(0.98, fl * 0.8, fireNear));
            this.place(p);
            const breathe = this.opts.reduceMotion ? 0 : Math.sin(now * 1.6 + p.bob) * 0.02;
            let hop = walking ? Math.abs(Math.sin(p.bob)) * 0.16 : 0;
            if (!walking && now < p.joyUntil) hop = Math.abs(Math.sin((p.joyUntil - now) * 9)) * 0.28;
            p.body.position.y = 0.05 + breathe + hop;
            // 토닥토닥: 좌우로 살짝 기울임. 뭉클: 조금 납작하게 처짐
            (p.body.material as THREE.SpriteMaterial).rotation = now < p.patUntil ? Math.sin(now * 9) * 0.16 : 0;
            const droop = now < p.tearUntil ? 0.08 * Math.min(1, (p.tearUntil - now) * 2) : 0;
            p.body.scale.set(1.15 * (1 + droop * 0.4), 1.15 * (1 - droop), 1);
            if (p.bubble) {
                const t = (now - p.bubble.born) / 2.2;
                if (t >= 1) {
                    p.group.remove(p.bubble.sprite);
                    p.bubble.sprite.material.map?.dispose();
                    p.bubble.sprite.material.dispose();
                    p.bubble = null;
                } else {
                    const s = 0.42 * Math.min(1, t * 6); // 톡 하고 커짐
                    p.bubble.sprite.scale.set(s, s, 1);
                    p.bubble.sprite.position.y = TAG_Y + p.tagLift + (p.tag ? TAG_H + 0.04 : 0) + t * 0.25;
                    p.bubble.sprite.material.opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
                }
            }
            // 하트
            p.hearts = p.hearts.filter((h) => {
                const t = (now - h.born) / 1.4;
                if (t < 0) return true;
                if (t >= 1) {
                    p.group.remove(h.sprite);
                    h.sprite.material.dispose();
                    return false;
                }
                h.sprite.position.y = 1.0 + t * 1.1;
                h.sprite.position.x += Math.sin(now * 6 + h.born) * 0.004;
                h.sprite.material.opacity = t < 0.7 ? 0.95 : 0.95 * (1 - (t - 0.7) / 0.3);
                return true;
            });
        }
        this.layoutTags(dt);
        // 소원 부두 도착
        if (this.wishPending && this.meId != null) {
            const me = this.people.get(this.meId);
            if (me && me.pos.distanceTo(me.target) < 0.05) {
                if (this.wishPending === 1) this.walkDockEnd();
                else this.arriveWish(now);
            }
        }
        // 부두 이름표·등불 숨 쉬듯. 가운데 이야기 카드와 겹치면 이름표를 숨김
        if (this.dockLabel) {
            if (now > this.cardCheckAt) {
                this.cardCheckAt = now + 0.25;
                const rect = this.opts.getCardRect();
                let covered = false;
                if (rect) {
                    const c = this.canvas.getBoundingClientRect();
                    const v = new THREE.Vector3();
                    for (const dy of [0, 0.35, 0.7]) {
                        v.copy(this.dockLabel.position)
                            .setY(this.dockLabel.position.y + dy)
                            .project(this.camera);
                        const sx = c.left + ((v.x + 1) / 2) * c.width,
                            sy = c.top + ((1 - v.y) / 2) * c.height;
                        if (v.z < 1 && sx > rect.left - 12 && sx < rect.right + 12 && sy > rect.top - 12 && sy < rect.bottom + 12) covered = true;
                    }
                }
                this.dockLabelFade = covered ? 0 : 1;
            }
            const breathe = this.opts.reduceMotion ? 0.9 : 0.75 + 0.25 * Math.sin(now * 2.2);
            const cur = this.dockLabel.material.opacity;
            this.dockLabel.material.opacity = cur + (breathe * this.dockLabelFade - cur) * Math.min(1, dt * 6);
            if (this.dockGlow && !this.opts.reduceMotion) this.dockGlow.material.opacity = 0.5 + 0.15 * Math.sin(now * 2.2);
        }
        // 막 띄운 풍등: 7초 동안 달 쪽 하늘로
        this.lanterns = this.lanterns.filter((l) => {
            const t = (now - l.born) / 7;
            if (t >= 1) {
                this.scene.remove(l.s);
                l.s.material.dispose();
                return false;
            }
            const e = t * (2 - t);
            l.s.position.set(l.start.x + MOON_DIR.x * e * 9 + Math.sin(now * 1.3 + l.sway) * 0.15, l.start.y + e * 11, l.start.z + MOON_DIR.z * e * 9);
            const sc = 1 - t * 0.45;
            l.s.scale.set(0.7 * sc, 0.86 * sc, 1);
            l.s.material.opacity = t < 0.08 ? t / 0.08 : t > 0.8 ? (1 - t) / 0.2 : 1;
            return true;
        });
        for (const w of this.skyWishes) {
            const f = w.flare ? Math.max(0, 1 - (now - w.flare) / 1.4) : 0; // 빌어 준 직후 1.4초 환하게
            const k = 1 + f * 0.45;
            w.s.scale.set(3.4 * k, 4.2 * k, 1);
            w.g.scale.set(9 * (1 + f), 9 * (1 + f), 1);
            w.g.material.opacity = 0.3 + f * 0.6;
            if (this.opts.reduceMotion) continue;
            w.s.material.opacity = Math.min(1, 0.75 + 0.2 * Math.sin(now * 1.1 + w.phase) + f * 0.3);
            w.s.position.y += Math.sin(now * 0.6 + w.phase) * 0.004;
            w.g.position.y = w.s.position.y;
        }
        // 그림자 요정: 천천히 나타나 아주 흐리게 숨 쉬듯
        for (const g of this.ghosts) {
            const m = g.s.material;
            const want = 0.26 + (this.opts.reduceMotion ? 0 : 0.05 * Math.sin(now * 0.8 + g.phase));
            m.opacity += (want - m.opacity) * Math.min(1, dt * 1.5);
            g.s.position.y += this.opts.reduceMotion ? 0 : Math.sin(now * 1.4 + g.phase) * 0.0006;
        }
        // 날아가는 하트 (마음 보내기)
        this.gifts = this.gifts.filter((g) => {
            const a = this.people.get(g.from),
                b = this.people.get(g.to);
            const t = (now - g.born) / GIFT_SEC;
            if (!a || !b || t >= 1) {
                this.scene.remove(g.sprite);
                g.sprite.material.dispose();
                if (b && t >= 1) this.hearts(g.to);
                return false;
            }
            const e = t * t * (3 - 2 * t);
            g.sprite.position.set(
                a.group.position.x + (b.group.position.x - a.group.position.x) * e,
                a.group.position.y + 0.8 + (b.group.position.y - a.group.position.y) * e + Math.sin(t * Math.PI) * 0.9,
                a.group.position.z + (b.group.position.z - a.group.position.z) * e,
            );
            return true;
        });

        // 떠오르는 별
        for (const [id, start] of this.pendingBorn) {
            const i = this.starIndex.get(id);
            if (i == null) {
                this.pendingBorn.delete(id);
                continue;
            }
            const born = (this.starGeo.attributes.aBorn as THREE.BufferAttribute).getX(i);
            const t = THREE.MathUtils.clamp((now - born) / 2.4, 0, 1);
            const e = 1 - Math.pow(1 - t, 3);
            const dest = this.starList[i].pos;
            (this.starGeo.attributes.position as THREE.BufferAttribute).setXYZ(i, THREE.MathUtils.lerp(start.x, dest.x, e), THREE.MathUtils.lerp(start.y, dest.y, e), THREE.MathUtils.lerp(start.z, dest.z, e));
            (this.starGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            if (t >= 1) this.pendingBorn.delete(id);
        }

        // 빛 줄기
        this.beams = this.beams.filter((b) => {
            const t = (now - b.born) / b.life;
            if (t >= 1) {
                this.scene.remove(b.line);
                this.scene.remove(b.spark);
                b.line.geometry.dispose();
                (b.line.material as THREE.Material).dispose();
                b.spark.material.dispose();
                return false;
            }
            (b.line.material as THREE.LineBasicMaterial).opacity = (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75) * 0.7;
            const kk = Math.min(1, t / 0.7);
            const e = 1 - Math.pow(1 - kk, 2);
            b.spark.position.lerpVectors(b.from, b.to, e);
            const sc = 0.9 + e * b.from.distanceTo(b.to) * 0.05;
            b.spark.scale.set(sc, sc, 1);
            (b.spark.material as THREE.SpriteMaterial).opacity = t < 0.7 ? 0.95 : 0.95 * (1 - (t - 0.7) / 0.3);
            return true;
        });

        // 별똥별
        if (now > this.nextMeteor) {
            this.spawnMeteor(false);
            this.nextMeteor = now + 2 + Math.random() * 3.5;
        }
        this.meteors = this.meteors.filter((m) => {
            const t = (now - m.born) / m.life;
            const hs = m.line.userData.head as THREE.Sprite | undefined;
            if (t >= 1) {
                this.sky.remove(m.line);
                m.line.geometry.dispose();
                (m.line.material as THREE.Material).dispose();
                if (hs) {
                    this.sky.remove(hs);
                    hs.material.dispose();
                }
                if (m.big && this.dailyResolve) {
                    const r = this.dailyResolve;
                    this.dailyResolve = null;
                    r();
                }
                return false;
            }
            const pos = m.line.geometry.attributes.position as THREE.BufferAttribute;
            const head = new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0)).addScaledVector(m.vel, dt);
            const tail = head.clone().sub(m.vel.clone().multiplyScalar((m.big ? 0.32 : 0.22) * (1 - t * 0.5)));
            pos.setXYZ(0, head.x, head.y, head.z);
            pos.setXYZ(1, tail.x, tail.y, tail.z);
            pos.needsUpdate = true;
            const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
            if (hs) {
                hs.position.copy(head);
                hs.material.opacity = (m.big ? 1 : 0.85) * fade;
            }
            (m.line.material as THREE.LineBasicMaterial).opacity = fade;
            return true;
        });

        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
        if (this.walkMark) {
            this.walkMark.geometry.dispose();
            (this.walkMark.material as THREE.Material).dispose();
        }
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        window.removeEventListener("resize", this.resize);
        window.removeEventListener("keydown", this.onKey);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        this.canvas.removeEventListener("pointerdown", this.onDown);
        this.canvas.removeEventListener("pointermove", this.onMove);
        this.canvas.removeEventListener("pointerup", this.onUp);
        this.canvas.removeEventListener("pointercancel", this.onCancel);
        this.canvas.removeEventListener("touchend", this.onTouchEnd);
        document.removeEventListener("visibilitychange", this.onVis);
        for (const id of [...this.people.keys()]) this.removePerson(id);
        this.scenery.dispose();
        this.tree.dispose();
        this.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
        });
        this.renderer.dispose();
    }
}

export function hasWebGL(): boolean {
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
        return false;
    }
}
