// 크리스마스트리: 언덕 오른쪽 작은 전나무 실루엣 + 따뜻한 노란 전구 + 꼭대기 별. 누르면 불빛이 반짝 퍼짐
// 요정처럼 늘 카메라 쪽을 보는 평면(좌우로만 돎). 색은 풍등·모닥불과 같은 따뜻한 빛 한 가지
import * as THREE from "three";
import { glowTexture } from "./sprites";

const W = 2.1,
    H = 3.15; // 트리 크기(월드). 요정 키의 두 배 남짓

// 그림 크기(px). 트리 평면 좌표(u: 왼→오 0~1, v: 아래→위 0~1)와 맞춤
const TW = 384,
    TH = 576;
// 4단 가지: [꼭짓점 y, 아래 y, 아래 반폭]
const TIERS: [number, number, number][] = [
    [52, 175, 78],
    [120, 285, 112],
    [215, 400, 146],
    [320, 505, 176],
];
// 금빛 줄(가랜드): 각 단을 비스듬히 가로지르는 처진 곡선 [x0, y0, 조절x, 조절y, x1, y1]
const GARLANDS: [number, number, number, number, number, number][] = [
    [150, 150, 196, 190, 238, 140],
    [118, 262, 185, 312, 272, 246],
    [92, 372, 196, 432, 300, 358],
    [70, 478, 192, 540, 318, 468],
];
const qb = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

// 실루엣 그림: 4단 가지(삐죽한 끝), 가지 끝에 눈, 금빛 줄, 작은 장식 공
function treeTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = TW;
    c.height = TH;
    const g = c.getContext("2d")!;
    const cx = TW / 2;
    // 줄기
    g.fillStyle = "#2a1a10";
    g.fillRect(cx - 16, 495, 32, 81);
    TIERS.forEach(([top, bottom, hw]) => {
        // 가지: 꼭짓점에서 양옆으로 내려가며 끝이 삐죽삐죽
        const grad = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
        grad.addColorStop(0, "#255c47");
        grad.addColorStop(0.45, "#1a4a39");
        grad.addColorStop(1, "#0e2a22");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(cx, top);
        const n = 7;
        for (let k = 1; k <= n; k++) {
            const t = k / n;
            g.lineTo(cx + hw * t * 0.82, top + (bottom - top) * t * 0.92);
            g.lineTo(cx + hw * t, top + (bottom - top) * t);
        }
        for (let k = 0; k <= 8; k++) {
            const x = cx + hw - (hw * 2 * k) / 8;
            g.lineTo(x, bottom + (k % 2 ? 9 : 0));
        }
        for (let k = n; k >= 1; k--) {
            const t = k / n;
            g.lineTo(cx - hw * t, top + (bottom - top) * t);
            g.lineTo(cx - hw * t * 0.82, top + (bottom - top) * t * 0.92);
        }
        g.closePath();
        g.fill();
        // 달빛 받는 왼쪽 가장자리 살짝 밝게
        g.strokeStyle = "rgba(170,210,255,0.18)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx, top + 4);
        g.lineTo(cx - hw + 6, bottom - 4);
        g.stroke();
        // 눈: 아래 가장자리 물결 + 가지 끝 덩어리
        g.fillStyle = "rgba(236,242,255,0.92)";
        for (let k = 0; k < 8; k++) {
            const x0 = cx + hw - (hw * 2 * k) / 8;
            g.beginPath();
            g.ellipse(x0 - hw / 8, bottom - 1, hw / 9, 5.5, 0, 0, Math.PI * 2);
            g.fill();
        }
        g.beginPath();
        g.ellipse(cx, top + 10, 11, 7, 0, 0, Math.PI * 2);
        g.fill();
    });
    // 금빛 줄
    g.strokeStyle = "rgba(255,214,130,0.75)";
    g.lineWidth = 2.5;
    for (const [x0, y0, x1c, y1c, x1, y1] of GARLANDS) {
        g.beginPath();
        g.moveTo(x0, y0);
        g.quadraticCurveTo(x1c, y1c, x1, y1);
        g.stroke();
    }
    // 전구 알: 금빛 줄 위 (반짝임은 위에 얹는 빛 스프라이트가 함)
    GARLANDS.forEach(([x0, y0, xc, yc, x1, y1], i) => {
        const n = 4 + i;
        for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n;
            const x = qb(x0, xc, x1, t),
                y = qb(y0, yc, y1, t);
            const gl = g.createRadialGradient(x, y, 0, x, y, 9);
            gl.addColorStop(0, "rgba(255,240,190,1)");
            gl.addColorStop(0.35, "rgba(255,214,130,0.9)");
            gl.addColorStop(1, "rgba(255,200,110,0)");
            g.fillStyle = gl;
            g.beginPath();
            g.arc(x, y, 9, 0, Math.PI * 2);
            g.fill();
        }
    });
    // 장식 공 (빨강·금·파랑, 조금씩)
    const BALLS: [number, number, string][] = [
        [168, 232, "#d8555f"], [230, 330, "#e8c36a"], [140, 342, "#7fa7e0"], [262, 418, "#d8555f"],
        [118, 452, "#e8c36a"], [214, 478, "#7fa7e0"], [300, 486, "#e8c36a"], [196, 170, "#e8c36a"],
    ];
    for (const [x, y, col] of BALLS) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)";
        g.beginPath();
        g.arc(x - 3, y - 3, 2.6, 0, Math.PI * 2);
        g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

// 꼭대기 별 (하늘의 별처럼 다섯 갈래, 은은하게)
function starTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffe6a0";
    g.shadowColor = "rgba(255,216,107,0.9)";
    g.shadowBlur = 10;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 10 : 24;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// 전구 자리: 금빛 줄을 따라 고르게 (트리 평면 좌표)
const BULBS: [number, number][] = GARLANDS.flatMap(([x0, y0, xc, yc, x1, y1], i) =>
    Array.from({ length: 4 + i }, (_, k) => {
        const t = (k + 0.5) / (4 + i);
        return [qb(x0, xc, x1, t) / TW, 1 - qb(y0, yc, y1, t) / TH] as [number, number];
    }),
);

export class ChristmasTree {
    group = new THREE.Group();
    private bulbMat: THREE.ShaderMaterial; // 전구 전부를 점 하나의 그리기로 (따로 그리면 그리기 명령이 22개 늘어 폰에서 무거움)
    private star: THREE.Sprite;
    private starGlow: THREE.Sprite;
    private base!: THREE.Mesh;
    private flareAt = -10;
    private texs: THREE.Texture[] = [];

    constructor(x: number, y: number, z: number, private reduceMotion: boolean) {
        this.group.position.set(x, y, z);
        const tt = treeTexture();
        // 몸통 Sprite 는 늘 카메라를 봄. 전구·별도 같은 평면에 있게 그룹을 카메라 쪽으로 돌림(update)
        // 불투명(alphaTest)으로 그려 깊이를 남김 → 트리 뒤 요정만 가려지고 앞의 요정은 트리 위에 그려짐. 전구는 그 앞에
        const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt, transparent: false, alphaTest: 0.3, depthWrite: true }));
        body.center.set(0.5, 0);
        body.scale.set(W, H, 1);
        this.group.add(body);
        // 발밑 눈 위 따뜻한 불빛
        const base = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: glowTexture("255,200,120"), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.04;
        this.base = base;
        this.group.add(base);
        const bulbTex = glowTexture("255,214,140");
        const n = BULBS.length;
        const pos = new Float32Array(n * 3),
            aPhase = new Float32Array(n),
            aSpeed = new Float32Array(n);
        BULBS.forEach(([u, v], i) => {
            pos.set([(u - 0.5) * W, v * H, 0.15], i * 3);
            aPhase[i] = Math.random() * Math.PI * 2;
            aSpeed[i] = 0.8 + Math.random() * 1.4;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
        geo.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
        this.bulbMat = new THREE.ShaderMaterial({
            uniforms: { uMap: { value: bulbTex }, uTime: { value: 0 }, uSince: { value: 10 }, uStill: { value: reduceMotion ? 1 : 0 }, uViewH: { value: 800 } },
            vertexShader: `
attribute float aPhase; attribute float aSpeed;
uniform float uTime; uniform float uSince; uniform float uStill; uniform float uViewH;
varying float vA;
void main(){
    float tw = uStill > 0.5 ? 0.8 : 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
    float v = position.y / ${H.toFixed(3)};
    float wave = (uSince >= 0.0 && uSince < 2.0) ? max(0.0, 1.0 - abs(uSince * 1.6 - v * 1.2) * 2.2) : 0.0;
    vA = min(1.0, 0.35 + tw * 0.65 + wave);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 월드 크기(0.32, 반짝일 때 더 큼) → 화면 px
    gl_PointSize = (0.32 + wave * 0.26) * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
}`,
            fragmentShader: `
uniform sampler2D uMap; varying float vA;
void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vA); }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const bulbs = new THREE.Points(geo, this.bulbMat);
        bulbs.renderOrder = 2; // 트리 그림 위에
        this.group.add(bulbs);
        const st = starTexture();
        this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false }));
        this.star.position.set(0, H * 0.935, 0.2);
        this.star.scale.set(0.44, 0.44, 1);
        this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,216,107"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 }));
        this.starGlow.position.copy(this.star.position);
        this.starGlow.scale.set(1.3, 1.3, 1);
        this.starGlow.renderOrder = 2;
        this.star.renderOrder = 3;
        this.group.add(this.starGlow, this.star);
        this.texs.push(tt, bulbTex, st, (this.starGlow.material as THREE.SpriteMaterial).map!);
    }

    // 누르기 판정용 점들 (월드)
    hitPoints(): THREE.Vector3[] {
        const p = this.group.position;
        return [0.2, 0.5, 0.8].map((k) => new THREE.Vector3(p.x, p.y + H * k, p.z));
    }

    // 누르면(또는 남이 누르면) 불빛이 아래에서 위로 반짝 퍼짐
    flare(now: number) {
        this.flareAt = now;
    }

    // view: 카메라가 보는 방향(라디안). 트리 평면을 카메라 쪽으로
    // viewH: 그리는 화면 높이(px, 픽셀 비율 포함) — 전구 크기 계산용
    update(now: number, view: number, viewH: number) {
        this.group.rotation.y = -view;
        const since = now - this.flareAt;
        // 반짝임·퍼짐(아래 전구부터 차례로)은 셰이더에서
        this.bulbMat.uniforms.uTime.value = now;
        this.bulbMat.uniforms.uSince.value = since;
        this.bulbMat.uniforms.uViewH.value = viewH;
        const starWave = since >= 0 && since < 2.4 ? Math.max(0, 1 - Math.abs(since - 1.1) * 1.4) : 0;
        const pulse = this.reduceMotion ? 0.45 : 0.4 + 0.1 * Math.sin(now * 1.3);
        (this.starGlow.material as THREE.SpriteMaterial).opacity = pulse + starWave * 0.5;
        (this.base.material as THREE.MeshBasicMaterial).opacity = 0.24 + 0.04 * Math.sin(now * 1.7) + starWave * 0.25;
        const ss = 1.1 + starWave * 1.2;
        this.starGlow.scale.set(ss, ss, 1);
    }

    dispose() {
        for (const t of this.texs) t.dispose();
    }
}
