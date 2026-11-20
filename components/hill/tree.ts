// 크리스마스트리: 언덕 오른쪽 작은 3D 전나무 + 나선으로 감은 금빛 줄·전구 + 장식 공 + 꼭대기 별. 누르면 불빛이 반짝 퍼짐
// 장면에 조명이 없어서 그늘은 꼭짓점 색에 미리 구워 둠(달·모닥불 쪽 = 왼쪽 위가 밝게). 화면을 돌리면 옆·뒷모습이 보임
// 그리기 명령: 몸통 1 · 장식 공 1 · 금빛 줄 1 · 전구 1 · 발밑 빛 1 · 별 2
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowTexture } from "./sprites";

const H = 3.15; // 트리 높이(월드). 요정 키의 두 배 남짓

// 4단 가지: [꼭짓점 y, 아래 y, 아래 반지름]
const TIERS: [number, number, number][] = [
    [2.87, 2.19, 0.43],
    [2.49, 1.59, 0.61],
    [1.97, 0.96, 0.8],
    [1.4, 0.39, 0.96],
];
const SEG = 10; // 둘레 조각 수 (적을수록 각진 그림 느낌)
const LIGHT = new THREE.Vector3(-0.7, 0.55, 0.45).normalize(); // 달·모닥불 쪽
const C_LIT = new THREE.Color("#22604a"),
    C_DARK = new THREE.Color("#0c2620"),
    C_SNOW = new THREE.Color("#e6eeff"),
    C_TRUNK = new THREE.Color("#3a2416");

// 높이 y 에서 트리 겉면 반지름 (전구·공 붙일 때)
function radiusAt(y: number): number {
    let r = 0;
    for (const [top, bottom, rr] of TIERS) if (y <= top && y >= bottom) r = Math.max(r, (rr * (top - y)) / (top - bottom));
    return r;
}

// 삼각형 목록 → 면마다 빛 방향으로 그늘을 구운 꼭짓점 색 붙인 기하
function shaded(tris: [THREE.Vector3, THREE.Color][][]): THREE.BufferGeometry {
    const pos: number[] = [],
        col: number[] = [];
    const e1 = new THREE.Vector3(),
        e2 = new THREE.Vector3(),
        n = new THREE.Vector3(),
        c = new THREE.Color();
    for (const [a, b, d] of tris) {
        e1.subVectors(b[0], a[0]);
        e2.subVectors(d[0], a[0]);
        n.crossVectors(e1, e2).normalize();
        const k = 0.45 + 0.55 * Math.max(0, n.dot(LIGHT)) + 0.1 * Math.max(0, n.y);
        for (const [p, base] of [a, b, d]) {
            pos.push(p.x, p.y, p.z);
            c.copy(base).multiplyScalar(k);
            col.push(c.r, c.g, c.b);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
}

// 가지 한 단: 꼭짓점(눈) → 중간 고리 → 삐죽한 아래 가장자리(끝에 눈) + 밑면
function tierTris([top, bottom, r]: [number, number, number], twist: number, first: boolean): [THREE.Vector3, THREE.Color][][] {
    const tris: [THREE.Vector3, THREE.Color][][] = [];
    const h = top - bottom;
    // 눈은 맨 위 꼭짓점에만 하얗게, 나머지는 살짝
    const apex: [THREE.Vector3, THREE.Color] = [new THREE.Vector3(0, top + 0.02, 0), first ? C_SNOW : C_LIT.clone().lerp(C_SNOW, 0.35)];
    const mid: [THREE.Vector3, THREE.Color][] = [],
        rim: [THREE.Vector3, THREE.Color][] = [];
    for (let i = 0; i < SEG * 2; i++) {
        const a = twist + (i / (SEG * 2)) * Math.PI * 2;
        const tip = i % 2 === 0;
        // 중간 고리: 위쪽은 눈이 녹아 섞인 색
        if (tip) mid.push([new THREE.Vector3(Math.sin(a) * r * 0.42, top - h * 0.4, Math.cos(a) * r * 0.42), C_DARK.clone().lerp(C_LIT, 0.45)]);
        const rr = tip ? r : r * 0.8;
        rim.push([new THREE.Vector3(Math.sin(a) * rr, bottom + (tip ? -0.07 : 0.08), Math.cos(a) * rr), tip ? C_LIT.clone().lerp(C_SNOW, 0.18) : C_LIT]);
    }
    const center: [THREE.Vector3, THREE.Color] = [new THREE.Vector3(0, bottom + 0.12, 0), C_DARK];
    for (let i = 0; i < SEG; i++) {
        const m0 = mid[i],
            m1 = mid[(i + 1) % SEG];
        const r0 = rim[i * 2],
            r1 = rim[i * 2 + 1],
            r2 = rim[(i * 2 + 2) % (SEG * 2)];
        tris.push([apex, m0, m1]);
        tris.push([m0, r0, r1], [m0, r1, m1], [m1, r1, r2]);
        // 밑면 (아래에서 볼 때 비어 보이지 않게)
        tris.push([center, r1, r0], [center, r2, r1]);
    }
    return tris;
}

function trunkTris(): [THREE.Vector3, THREE.Color][][] {
    const tris: [THREE.Vector3, THREE.Color][][] = [];
    const n = 6,
        r = 0.1,
        y1 = 0.5;
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2,
            a1 = ((i + 1) / n) * Math.PI * 2;
        const p = (a: number, y: number): [THREE.Vector3, THREE.Color] => [new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r), C_TRUNK];
        tris.push([p(a0, 0), p(a1, 0), p(a1, y1)], [p(a0, 0), p(a1, y1), p(a0, y1)]);
    }
    return tris;
}

// 나선: 아래에서 위로 감기는 금빛 줄 자리 (s 0~1)
const SPIRAL_TURNS = 3.5;
function spiral(s: number, out = 0.04): THREE.Vector3 {
    const y = 0.5 + s * 2.2;
    const a = s * SPIRAL_TURNS * Math.PI * 2 + 0.6;
    const r = radiusAt(y) * 0.86 + out;
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
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

// 고정 난수 (새로 고쳐도 장식 자리가 같게)
function rng(seed: number) {
    return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

export class ChristmasTree {
    group = new THREE.Group();
    private bulbMat: THREE.ShaderMaterial; // 전구 전부를 점 하나의 그리기로 (따로 그리면 그리기 명령이 많이 늘어 폰에서 무거움)
    private star: THREE.Sprite;
    private starGlow: THREE.Sprite;
    private base!: THREE.Mesh;
    private flareAt = -10;
    private texs: THREE.Texture[] = [];
    private geos: THREE.BufferGeometry[] = [];

    constructor(x: number, y: number, z: number, private reduceMotion: boolean) {
        this.group.position.set(x, y, z);
        // 몸통: 줄기 + 4단 가지를 한 덩어리로. 불투명이라 깊이로 트리 뒤 요정·전구만 가려짐
        const body = mergeGeometries([shaded(trunkTris()), ...TIERS.map((t, i) => shaded(tierTris(t, i * 0.31, i === 0)))])!;
        this.geos.push(body);
        this.group.add(new THREE.Mesh(body, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

        // 장식 공 (빨강·금·파랑): 한 번에 그리기. 공마다 왼쪽 위가 밝게 구움
        const ballGeo = new THREE.IcosahedronGeometry(0.065, 1);
        const bn = ballGeo.getAttribute("normal"),
            bc: number[] = [];
        for (let i = 0; i < bn.count; i++) {
            const d = Math.max(0, bn.getX(i) * LIGHT.x + bn.getY(i) * LIGHT.y + bn.getZ(i) * LIGHT.z);
            const v = 0.45 + 0.55 * d + (d > 0.9 ? 0.5 : 0);
            bc.push(v, v, v);
        }
        ballGeo.setAttribute("color", new THREE.Float32BufferAttribute(bc, 3));
        this.geos.push(ballGeo);
        const BALL_COLS = ["#d8555f", "#e8c36a", "#7fa7e0"].map((c) => new THREE.Color(c));
        const rand = rng(7);
        const spots: THREE.Vector3[] = [];
        TIERS.forEach(([top, bottom], ti) => {
            const n = 4 + ti * 2;
            for (let k = 0; k < n; k++) {
                const yy = bottom + (top - bottom) * (0.12 + rand() * 0.4);
                const a = (k / n) * Math.PI * 2 + rand() * 0.5;
                const r = radiusAt(yy) * 0.9 + 0.04;
                spots.push(new THREE.Vector3(Math.sin(a) * r, yy, Math.cos(a) * r));
            }
        });
        const balls = new THREE.InstancedMesh(ballGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), spots.length);
        const m = new THREE.Matrix4();
        spots.forEach((p, i) => {
            balls.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
            balls.setColorAt(i, BALL_COLS[i % 3]);
        });
        this.group.add(balls);

        // 금빛 줄: 나선
        const linePts = Array.from({ length: 140 }, (_, i) => spiral(i / 139, 0.02));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
        this.geos.push(lineGeo);
        this.group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffd682, transparent: true, opacity: 0.7 })));

        // 발밑 눈 위 따뜻한 불빛
        const base = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: glowTexture("255,200,120"), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.04;
        this.base = base;
        this.group.add(base);

        // 전구: 금빛 줄을 따라. 트리 뒤쪽 것은 몸통에 가려짐
        const bulbTex = glowTexture("255,214,140");
        const n = 30;
        const pos = new Float32Array(n * 3),
            aPhase = new Float32Array(n),
            aSpeed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const p = spiral((i + 0.5) / n, 0.06);
            pos.set([p.x, p.y, p.z], i * 3);
            aPhase[i] = Math.random() * Math.PI * 2;
            aSpeed[i] = 0.8 + Math.random() * 1.4;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
        geo.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
        this.geos.push(geo);
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
    // 월드 크기(0.3, 반짝일 때 더 큼) → 화면 px
    gl_PointSize = (0.3 + wave * 0.26) * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
}`,
            fragmentShader: `
uniform sampler2D uMap; varying float vA;
void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vA); }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const bulbs = new THREE.Points(geo, this.bulbMat);
        bulbs.renderOrder = 2;
        this.group.add(bulbs);

        const st = starTexture();
        this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false }));
        this.star.position.set(0, H * 0.96, 0);
        this.star.scale.set(0.44, 0.44, 1);
        this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,216,107"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 }));
        this.starGlow.position.copy(this.star.position);
        this.starGlow.scale.set(1.3, 1.3, 1);
        this.starGlow.renderOrder = 2;
        this.star.renderOrder = 3;
        this.group.add(this.starGlow, this.star);
        this.texs.push(bulbTex, st, (this.starGlow.material as THREE.SpriteMaterial).map!, (base.material as THREE.MeshBasicMaterial).map!);
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

    // viewH: 그리는 화면 높이(px, 픽셀 비율 포함) — 전구 크기 계산용
    update(now: number, viewH: number) {
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
        for (const g of this.geos) g.dispose();
    }
}
