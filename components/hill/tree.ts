// 크리스마스트리: 언덕 오른쪽 작은 전나무 실루엣 + 따뜻한 노란 전구 + 꼭대기 별. 누르면 불빛이 반짝 퍼짐
// 요정처럼 늘 카메라 쪽을 보는 평면(좌우로만 돎). 색은 풍등·모닥불과 같은 따뜻한 빛 한 가지
import * as THREE from "three";
import { glowTexture } from "./sprites";

const W = 2.0,
    H = 2.9; // 트리 크기(월드). 요정 키의 두 배 남짓

// 실루엣 그림: 3단 가지, 가지 끝에 눈
function treeTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const g = c.getContext("2d")!;
    // 줄기
    g.fillStyle = "#24170f";
    g.fillRect(116, 330, 24, 54);
    // 가지 3단 (아래가 넓게). 각 단은 아래가 살짝 처진 삼각형
    // [가운데 x, 꼭짓점 y, 아래 y]
    const tiers: [number, number, number][] = [
        [128, 40, 150],
        [128, 120, 250],
        [128, 205, 340],
    ];
    const halfW = [62, 92, 120];
    tiers.forEach(([cx, top, bottom], i) => {
        const hw = halfW[i];
        const grad = g.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, "#1e4a3c");
        grad.addColorStop(1, "#0d2621");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(cx, top);
        g.quadraticCurveTo(cx + hw * 0.55, top + (bottom - top) * 0.55, cx + hw, bottom);
        // 아랫단 가장자리: 물결
        for (let k = 1; k <= 6; k++) {
            const x = cx + hw - (hw * 2 * k) / 6;
            g.quadraticCurveTo(x + hw / 6, bottom + 10, x, bottom);
        }
        g.quadraticCurveTo(cx - hw * 0.55, top + (bottom - top) * 0.55, cx, top);
        g.fill();
        // 눈: 각 단 아랫 가장자리와 꼭대기에 옅은 흰빛
        g.strokeStyle = "rgba(220,230,255,0.42)";
        g.lineWidth = 5;
        g.lineCap = "round";
        g.beginPath();
        for (let k = 0; k < 6; k++) {
            const x0 = cx + hw - (hw * 2 * k) / 6;
            const x1 = cx + hw - (hw * 2 * (k + 1)) / 6;
            g.moveTo(x0 - 4, bottom - 3);
            g.quadraticCurveTo((x0 + x1) / 2, bottom + 5, x1 + 4, bottom - 3);
        }
        g.stroke();
        g.fillStyle = "rgba(215,226,255,0.5)";
        g.beginPath();
        g.ellipse(cx, top + 14, 10, 6, 0, 0, Math.PI * 2);
        g.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
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
        const r = i % 2 ? 9 : 22;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// 전구 자리 (트리 평면 좌표, 0~1: x 왼→오, y 아래→위). 가지를 따라 비스듬히 감기는 줄
const BULBS: [number, number][] = [
    [0.47, 0.8], [0.56, 0.74],
    [0.38, 0.66], [0.5, 0.62], [0.62, 0.57],
    [0.3, 0.47], [0.43, 0.44], [0.57, 0.41], [0.7, 0.37],
    [0.24, 0.24], [0.37, 0.22], [0.5, 0.2], [0.63, 0.18], [0.77, 0.15],
];

export class ChristmasTree {
    group = new THREE.Group();
    private bulbs: { s: THREE.Sprite; phase: number; speed: number }[] = [];
    private star: THREE.Sprite;
    private starGlow: THREE.Sprite;
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
        const bulbTex = glowTexture("255,214,140");
        for (const [u, v] of BULBS) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
            s.position.set((u - 0.5) * W, v * H, 0.02);
            s.scale.set(0.2, 0.2, 1);
            s.renderOrder = 2; // 트리 그림 위에
            this.group.add(s);
            this.bulbs.push({ s, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.4 });
        }
        const st = starTexture();
        this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false }));
        this.star.position.set(0, H * 0.985, 0.03);
        this.star.scale.set(0.34, 0.34, 1);
        this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,216,107"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 }));
        this.starGlow.position.copy(this.star.position);
        this.starGlow.scale.set(1.1, 1.1, 1);
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
    update(now: number, view: number) {
        this.group.rotation.y = -view;
        const since = now - this.flareAt;
        for (const b of this.bulbs) {
            const tw = this.reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(now * b.speed + b.phase);
            // 반짝 퍼짐: 아래 전구부터 차례로 밝아졌다 돌아옴
            const v = b.s.position.y / H;
            const wave = since >= 0 && since < 2 ? Math.max(0, 1 - Math.abs(since * 1.6 - v * 1.2) * 2.2) : 0;
            const m = b.s.material as THREE.SpriteMaterial;
            m.opacity = Math.min(1, tw * 0.85 + wave);
            const sc = 0.24 + wave * 0.24;
            b.s.scale.set(sc, sc, 1);
        }
        const starWave = since >= 0 && since < 2.4 ? Math.max(0, 1 - Math.abs(since - 1.1) * 1.4) : 0;
        const pulse = this.reduceMotion ? 0.45 : 0.4 + 0.1 * Math.sin(now * 1.3);
        (this.starGlow.material as THREE.SpriteMaterial).opacity = pulse + starWave * 0.5;
        const ss = 1.1 + starWave * 1.2;
        this.starGlow.scale.set(ss, ss, 1);
    }

    dispose() {
        for (const t of this.texs) t.dispose();
    }
}
