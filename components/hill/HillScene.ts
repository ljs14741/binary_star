// 밤의 언덕 3D 장면 (three.js). React 와 분리된 클래스
// 하늘: 황도 12궁 별자리가 카메라 둘레 360도에 고리로 떠 있음. 주제 방이 붙은 별자리는 이야기 별로 채워지고, 없는 별자리는 흐리게 모양만
//       끌어서 돌아보고(관성), 고른 별자리만 밝고 크게. 이름(별자리·주제)은 모양 아래 글자
// 언덕: 바다 위 작은 섬. 별 요정들이 모닥불 둘레에 앉아 있음. 땅을 누르면 걸어가고, PC 는 방향키를 누르는 동안만 걸음
// 풍경: 오로라(왼쪽 뒤) · 바다 · 등대(앞 오른쪽) · 모닥불 · 가끔 돌고래 (scenery.ts)
import * as THREE from "three";
import type { SkyData, SkyStar } from "@/lib/hill";
import type { Lang } from "@/lib/i18n/config";
import type { MemberPublic, Pose, StarEvent } from "@/lib/realtime/protocol";
import { FIRE_POS, HILL_HALF_D, HILL_HALF_W } from "@/lib/realtime/protocol";
import type { Sfx } from "@/lib/sound";
import { CREATURE_KINDS, creatureTexture, glowTexture, heartTexture, ME_PALETTE, PALETTES, textTexture, wrapTitle, type CreatureKind, type Palette } from "./sprites";
import { assignRooms, ZODIAC, type Shape } from "./constellations";
import { Scenery } from "./scenery";
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
    reduceMotion: boolean;
};

const WALK_SPEED = 1.9;
const KEY_SPEED = 2.8;
const KEY_SEND_MS = 150;
const MAX_STARS = 320;
const HIGHLIGHT_EVERY = 5.5; // 초
const EMPTY_WAIT = 9; // 빈 별자리에 머무는 시간
const DEG = Math.PI / 180;
const CAM_Y = SKY_ORIGIN.y;

export function hillHeight(x: number, z: number): number {
    return 1.15 * Math.exp(-(x * x) / 70 - (z * z) / 22) + 0.12 * Math.sin(x * 0.7) * Math.cos(z * 0.9) + 0.05 * Math.sin(x * 2.1 + z * 1.3);
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
    hearts: { sprite: THREE.Sprite; born: number }[];
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
    label: THREE.Sprite; // 별자리 이름
    labelAspect: number;
    sub: THREE.Sprite; // 주제 방 이름 (없으면 안내)
    subAspect: number;
    subLines: number;
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
    private people = new Map<number, Person>();
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
    private dragging = false;
    private pointer: { x: number; y: number; moved: boolean; id: number; startView: number; lastX: number; lastT: number; vel: number } | null = null;
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

    constructor(private canvas: HTMLCanvasElement, private opts: SceneOpts) {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        this.isMobile = isMobile;
        this.selScale = isMobile ? 1.3 : 1.2;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: "low-power" });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R * 1.35, 24, 16), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false }));
        this.scene.add(dome);
        this.ground = this.makeGround();
        this.scene.add(this.ground);
        this.scene.add(this.makeFarHills());
        this.scenery = new Scenery({ reduceMotion: opts.reduceMotion, isMobile }, FIRE_POS.x, FIRE_POS.z, hillHeight(FIRE_POS.x, FIRE_POS.z));
        this.scene.add(this.scenery.group);

        // 달 (오른쪽 위)
        const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,236,196"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        const moonAt = fromAngles(62, 52, DOME_R * 1.1);
        moonGlow.position.set(moonAt.x, moonAt.y, moonAt.z);
        moonGlow.scale.set(26, 26, 1);
        this.scene.add(moonGlow);
        const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,244,214"), transparent: true, opacity: 1, depthWrite: false }));
        moon.position.copy(moonGlow.position);
        moon.scale.set(5.5, 5.5, 1);
        this.scene.add(moon);

        const bg = this.makeBackgroundStars(isMobile ? 600 : 900);
        this.bgMat = bg.material as THREE.ShaderMaterial;
        this.scene.add(bg);

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
        this.scene.add(this.stars);

        this.glowMe = glowTexture("255,216,107");
        this.glowOther = glowTexture("170,180,255");
        this.heartTex = heartTexture();

        this.resize();
        window.addEventListener("resize", this.resize);
        canvas.addEventListener("pointerdown", this.onDown);
        canvas.addEventListener("pointermove", this.onMove);
        canvas.addEventListener("pointerup", this.onUp);
        canvas.addEventListener("pointercancel", this.onCancel);
        window.addEventListener("keydown", this.onKey);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        document.addEventListener("visibilitychange", this.onVis);
        this.nextMeteor = 5 + Math.random() * 8;
        this.loop();
    }

    // ---------- 만들기 ----------
    private makeGround(): THREE.Mesh {
        // 바다 위 섬: 가운데 언덕, 가장자리는 물로 내려가는 비탈
        const W = 60, D = 60, sx = 90, sz = 90;
        const geo = new THREE.PlaneGeometry(W, D, sx, sz);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const colors = new Float32Array(pos.count * 3);
        const top = new THREE.Color("#161f4c"), bottom = new THREE.Color("#070b1f"), edge = new THREE.Color("#04061a"), warm = new THREE.Color("#4a2a1c");
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const r = Math.hypot(x * 0.62, z) + Math.sin(Math.atan2(z, x) * 3) * 0.6;
            const shore = Math.max(0, (r - 11) / 8);
            const y = hillHeight(x, z) - Math.pow(shore, 1.4) * 2.6;
            pos.setY(i, y);
            const t = THREE.MathUtils.clamp(y / 1.25, 0, 1);
            const far = THREE.MathUtils.clamp(r / 16 + shore * 0.5, 0, 1);
            const c = bottom.clone().lerp(top, t).lerp(edge, far * far);
            // 모닥불 둘레는 살짝 따뜻하게
            const df = Math.hypot(x - FIRE_POS.x, z - FIRE_POS.z);
            c.lerp(warm, Math.max(0, 1 - df / 3.2) * 0.55);
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
        const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), phase = new Float32Array(n), born = new Float32Array(n), hot = new Float32Array(n), color = new Float32Array(n * 3);
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
            this.scene.remove(c.lines);
            c.lines.geometry.dispose();
            (c.lines.material as THREE.Material).dispose();
            for (const s of [c.label, c.sub]) {
                this.scene.remove(s);
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
        const cells = ringLayout(ZODIAC.length);
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
                const ia = slotToBuf.get(a), ib = slotToBuf.get(b);
                if (ia != null && ib != null) linePairs.push([ia, ib]);
            }
            const lgeo = new THREE.BufferGeometry();
            lgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePairs.length * 6), 3));
            const lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0xc9d4ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
            this.scene.add(lines);
            // 이름표: 별자리 이름 + 주제 방 이름(없으면 안내)
            const zl = textTexture(`${shape.symbol} ${shape.names[this.opts.lang]}`, { size: 44, color: "#ffffff", font: "600", pad: 24 });
            const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: zl.tex, transparent: true, depthWrite: false, opacity: 0.6 }));
            const subText = room ? wrapTitle(room.title, this.isMobile ? 9 : 12) : this.opts.emptyLabel;
            const sl = textTexture(subText, { size: 40, color: "#ffffff", font: room ? "600" : "400", pad: 24 });
            const sub = new THREE.Sprite(new THREE.SpriteMaterial({ map: sl.tex, transparent: true, depthWrite: false, opacity: 0.5 }));
            this.scene.add(label, sub);
            const sc = prevScale.get(zi) ?? (zi === this.index ? this.selScale : 1);
            this.constellations.push({ index: zi, shape, slug: room?.slug ?? null, title: room?.title ?? null, cell, starIds: ids, lines, linePairs, label, labelAspect: zl.aspect, sub, subAspect: sl.aspect, subLines: subText.split("\n").length, scale: sc, scaleTarget: sc });
        });
        this.starGeo.setDrawRange(0, this.starList.length);
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
            const pa = this.starList[a].pos, pb = this.starList[b].pos;
            lp.setXYZ(k * 2, pa.x, pa.y, pa.z);
            lp.setXYZ(k * 2 + 1, pb.x, pb.y, pb.z);
        });
        lp.needsUpdate = true;
        c.lines.geometry.computeBoundingSphere();
        // 이름표: 모양 바로 아래 (별자리 이름, 그 아래 주제)
        const sel = c.index === this.index;
        const base = 2.4 * (sel ? 1.12 : 1) * (this.isMobile ? 1.1 : 1);
        const cellW = Math.tan(c.cell.half * 1.35 * DEG) * 2 * DOME_R;
        const lh = Math.min(base, cellW / c.labelAspect);
        const l1 = starPoint(c.cell, 0, -1.28 - 0.08 * c.scale, c.scale);
        c.label.position.set(l1.x, l1.y, l1.z);
        c.label.scale.set(lh * c.labelAspect, lh, 1);
        let sh = base * 0.82 * (c.subLines > 1 ? 0.9 * c.subLines : 1);
        if (sh * c.subAspect > cellW) sh = cellW / c.subAspect;
        const l2 = starPoint(c.cell, 0, -1.28 - 0.08 * c.scale - 0.3 - 0.14 * c.subLines, c.scale);
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
            lm.opacity = sel ? 1 : c.slug ? 0.62 : 0.4;
            lm.color.set(sel ? 0xffd86b : 0xc9d4ff);
            const sm = c.sub.material as THREE.SpriteMaterial;
            sm.opacity = sel ? 0.95 : c.slug ? 0.55 : 0.3;
            sm.color.set(sel ? 0xffffff : 0xc9d4ff);
        }
        const now = this.clock.getElapsedTime();
        for (let i = 0; i < this.starList.length; i++) this.writeStar(i, (this.starGeo.attributes.aBorn as THREE.BufferAttribute).getX(i), now);
        this.flagStarAttrs();
    }

    count(): number {
        return this.constellations.length;
    }

    // 별자리 고르기 (‹ › · 띠 · 쓸기 · 별자리 누르기). 카메라가 그쪽으로 돎
    goTo(index: number, silent = false) {
        if (this.constellations.length === 0) return;
        const n = this.constellations.length;
        const next = ((index % n) + n) % n;
        this.select(next, silent);
        // 가장 가까운 방향으로 돌기
        const want = this.constellations[next].cell.az * DEG;
        const cur = this.view;
        const full = Math.PI * 2;
        let t = want;
        while (t - cur > full / 2) t -= full;
        while (t - cur < -full / 2) t += full;
        this.viewTarget = t;
        this.viewVel = 0;
    }

    // 주제가 있는 다음/이전 별자리로
    goToRoom(dir: number) {
        const n = this.constellations.length;
        if (!n) return;
        for (let k = 1; k <= n; k++) {
            const i = (((this.index + dir * k) % n) + n) % n;
            if (this.constellations[i].slug) {
                this.goTo(i);
                return;
            }
        }
        this.goTo(this.index + dir);
    }

    private select(next: number, silent = false) {
        if (next === this.index) return;
        this.index = next;
        this.opts.onIndexChange(next);
        this.highlightCursor = -1;
        // 주제 없는 별자리를 골랐으면 바로 넘어가지 않고 잠시 머묾
        this.highlightAt = this.clock.getElapsedTime() + (this.constellations[next]?.starIds.length ? 0.9 : EMPTY_WAIT);
        this.setHighlight(null);
        this.applySelection();
        if (!silent) this.opts.onSfx("select");
    }

    // 지금 보는 방향에서 가장 가까운 별자리
    private nearestToView(): number {
        let best = this.index, bestD = Infinity;
        const az = this.view / DEG;
        for (const c of this.constellations) {
            const d = Math.abs(azDelta(c.cell.az, az));
            if (d < bestD) {
                bestD = d;
                best = c.index;
            }
        }
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
        if (c.starIds.length === 0) {
            this.goToRoom(1);
            return HIGHLIGHT_EVERY;
        }
        if (this.highlightCursor + 1 >= c.starIds.length) {
            this.goToRoom(1);
            return 0.9;
        }
        this.highlightCursor++;
        const i = this.starIndex.get(c.starIds[this.highlightCursor]);
        if (i != null) {
            this.setHighlight(i);
            this.opts.onSfx("twinkle");
        }
        return HIGHLIGHT_EVERY;
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
            const start = from ? from.group.position.clone().add(new THREE.Vector3(0, 1.0, 0)) : this.horizonPoint();
            this.addBeam(start, st.pos, st.mine ? 0xff9bb3 : 0xffd86b);
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
        if (this.meteors.length >= (big ? 3 : 2)) return;
        const base = this.view / DEG;
        const p = big ? fromAngles(base + 12, 50, DOME_R * 1.05) : fromAngles(base + (Math.random() * 2 - 1) * 26 + 8, 34 + Math.random() * 24, DOME_R * 1.05);
        const start = new THREE.Vector3(p.x, p.y, p.z);
        // 화면 왼쪽 아래로 (카메라 방향 기준)
        const right = new THREE.Vector3(Math.cos(this.view), 0, Math.sin(this.view));
        const vel = right.multiplyScalar(-(big ? 12 : 14 + Math.random() * 10)).add(new THREE.Vector3(0, -(big ? 14 : 9 + Math.random() * 6), 0));
        const len = big ? 2.4 : 1.1;
        const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone().sub(vel.clone().multiplyScalar(len * 0.1))]);
        const mat = new THREE.LineBasicMaterial({ color: big ? 0xfff4d6 : 0xfff0c8, transparent: true, opacity: big ? 1 : 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        if (big) {
            const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMe, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
            head.scale.set(3.2, 3.2, 1);
            head.position.copy(start);
            this.scene.add(head);
            line.userData.head = head;
        }
        this.meteors.push({ line, vel, born: this.clock.getElapsedTime(), life: big ? 2.2 : 1.1, big });
        this.opts.onSfx(big ? "daily" : "meteor");
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
        for (const p of this.people.values()) this.applyLook(p);
    }

    syncMembers(you: MemberPublic, members: MemberPublic[]) {
        const keep = new Set<number>([you.id, ...members.map((m) => m.id)]);
        for (const id of [...this.people.keys()]) if (!keep.has(id)) this.removePerson(id);
        this.meId = you.id;
        for (const m of [you, ...members]) this.upsert(m, true);
    }

    applyTick(moved: [number, number, number, Pose][], joined: MemberPublic[], left: number[]) {
        for (const m of joined) this.upsert(m, true);
        for (const id of left) this.removePerson(id);
        for (const [id, x, z, p] of moved) {
            const person = this.people.get(id);
            if (!person || id === this.meId) continue;
            person.target.set(x, z);
            person.pose = p;
        }
    }

    moveMe(x: number, z: number) {
        if (this.meId == null) return;
        const me = this.people.get(this.meId);
        if (!me) return;
        me.target.set(x, z);
        me.pose = "sit";
    }

    // 방향키: 누르는 동안만 매 프레임 움직임 (루프에서 호출)
    private stepKeys(dt: number, now: number) {
        if (this.meId == null) return;
        const me = this.people.get(this.meId);
        if (!me) return;
        let dx = 0, dz = 0;
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
            p = { id: m.id, group, body, glow, pal, target: new THREE.Vector2(m.x, m.z), pos: new THREE.Vector2(m.x, m.z), pose: m.p, bob: Math.random() * 6.28, nextBlink: now + 2 + Math.random() * 4, blinkUntil: 0, lookUntil: 0, happyUntil: 0, walkUntil: 0, hearts: [] };
            this.people.set(m.id, p);
            this.applyLook(p);
        } else {
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
        this.people.delete(id);
    }

    private place(p: Person) {
        p.group.position.set(p.pos.x, hillHeight(p.pos.x, p.pos.y), p.pos.y);
    }

    // ---------- 입력 ----------
    private onDown = (e: PointerEvent) => {
        this.pointer = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, startView: this.view, lastX: e.clientX, lastT: performance.now(), vel: 0 };
        this.viewTarget = null;
        this.viewVel = 0;
        try {
            this.canvas.setPointerCapture(e.pointerId);
        } catch {}
    };
    private onMove = (e: PointerEvent) => {
        if (!this.pointer || this.pointer.id !== e.pointerId) return;
        const dx = e.clientX - this.pointer.x, dy = e.clientY - this.pointer.y;
        if (!this.pointer.moved && Math.hypot(dx, dy) < 8) return;
        this.pointer.moved = true;
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
    private static isTyping(e: KeyboardEvent): boolean {
        const tag = (e.target as HTMLElement | null)?.tagName;
        return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
    }
    private onKey = (e: KeyboardEvent) => {
        if (HillScene.isTyping(e)) return;
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
        if (cell != null) {
            if (cell !== this.index) this.goTo(cell);
            return;
        }
        this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
        const inter = this.ray.intersectObject(this.ground, false);
        if (inter.length) {
            const pt = inter[0].point;
            const x = THREE.MathUtils.clamp(pt.x, -HILL_HALF_W, HILL_HALF_W);
            const z = THREE.MathUtils.clamp(pt.z, -HILL_HALF_D, HILL_HALF_D);
            this.moveMe(x, z);
            this.opts.onGroundTap(Math.round(x * 10) / 10, Math.round(z * 10) / 10);
        }
    }

    private cellAt(nx: number, ny: number, w: number, h: number): number | null {
        const v = new THREE.Vector3();
        for (const c of this.constellations) {
            const center = starPoint(c.cell, 0, 0, c.scale);
            v.set(center.x, center.y, center.z).project(this.camera);
            if (v.z > 1) continue;
            const edge = starPoint(c.cell, 1, 0, c.scale);
            const ev = new THREE.Vector3(edge.x, edge.y, edge.z).project(this.camera);
            const rx = Math.abs(ev.x - v.x) * 1.25, ry = rx * (w / h) * 1.15 + 0.03;
            if (Math.abs(nx - v.x) < rx && ny < v.y + ry && ny > v.y - ry * 1.9) return c.index;
        }
        return null;
    }

    // 확인용: 내 요정 위치
    mePos(): { x: number; z: number } | null {
        const me = this.meId != null ? this.people.get(this.meId) : null;
        return me ? { x: me.pos.x, z: me.pos.y } : null;
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
            v.copy(s.pos).project(this.camera);
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
        let best: number | null = null, bestD = (px * 2) / Math.min(w, h);
        for (let i = 0; i < this.starList.length; i++) {
            const s = this.starList[i];
            v.copy(s.pos).project(this.camera);
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
        this.camera.fov = w < h ? 76 : 58;
        this.camera.updateProjectionMatrix();
    };
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
            if (near !== this.index) this.select(near, true);
        }
        this.pitch += (this.pitchTarget - this.pitch) * Math.min(1, dt * 6);
        this.camera.position.set(SKY_ORIGIN.x, CAM_Y + this.pitch * 2, SKY_ORIGIN.z);
        const lookY = CAM_Y + 20 * Math.tan(SKY_V_CENTER * DEG) + this.pitch * 14;
        this.camera.lookAt(SKY_ORIGIN.x + Math.sin(this.view) * 20, lookY, SKY_ORIGIN.z - Math.cos(this.view) * 20);

        this.scenery.update(now, dt, this.view);

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

        // 요정들
        for (const p of this.people.values()) {
            const d = p.pos.distanceTo(p.target);
            let kind: CreatureKind = "idle";
            const walking = d > 0.03 || now < p.walkUntil;
            if (walking) {
                if (d > 0.03) {
                    const step = Math.min(d, WALK_SPEED * dt);
                    p.pos.lerp(p.target, step / d);
                    p.bob += dt * 10;
                }
                kind = Math.sin(p.bob) > 0 ? "walk1" : "walk2";
            } else {
                if (now > p.nextBlink) {
                    p.blinkUntil = now + 0.14;
                    p.nextBlink = now + 2.5 + Math.random() * 4;
                }
                if (now < p.happyUntil) kind = "happy";
                else if (now < p.blinkUntil) kind = "blink";
                else if (now < p.lookUntil) kind = "lookup";
            }
            const tex = this.tex(p.pal)[kind];
            const mat = p.body.material as THREE.SpriteMaterial;
            if (mat.map !== tex) {
                mat.map = tex;
                mat.needsUpdate = true;
            }
            this.place(p);
            const breathe = this.opts.reduceMotion ? 0 : Math.sin(now * 1.6 + p.bob) * 0.02;
            const hop = walking ? Math.abs(Math.sin(p.bob)) * 0.16 : 0;
            p.body.position.y = 0.05 + breathe + hop;
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
            this.nextMeteor = now + 9 + Math.random() * 14;
        }
        this.meteors = this.meteors.filter((m) => {
            const t = (now - m.born) / m.life;
            const hs = m.line.userData.head as THREE.Sprite | undefined;
            if (t >= 1) {
                this.scene.remove(m.line);
                m.line.geometry.dispose();
                (m.line.material as THREE.Material).dispose();
                if (hs) {
                    this.scene.remove(hs);
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
            const tail = head.clone().sub(m.vel.clone().multiplyScalar((m.big ? 0.32 : 0.14) * (1 - t * 0.5)));
            pos.setXYZ(0, head.x, head.y, head.z);
            pos.setXYZ(1, tail.x, tail.y, tail.z);
            pos.needsUpdate = true;
            if (hs) hs.position.copy(head);
            (m.line.material as THREE.LineBasicMaterial).opacity = (m.big ? 1 : 0.8) * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
            return true;
        });

        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
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
        document.removeEventListener("visibilitychange", this.onVis);
        for (const id of [...this.people.keys()]) this.removePerson(id);
        this.scenery.dispose();
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
