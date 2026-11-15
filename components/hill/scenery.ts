// 밤 풍경: 오로라(하늘 위), 어두운 바다 + 등대(언덕 너머 앞쪽), 모닥불(언덕 위). 외부 이미지 없이 셰이더·캔버스로
import * as THREE from "three";
import { DOME_R, fromAngles, SKY_ORIGIN } from "./sky";
import { glowTexture } from "./sprites";

export type SceneryOpts = { reduceMotion: boolean; isMobile: boolean };

const AURORA_VERT = `
varying vec2 vUv; varying vec3 vPos;
void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// 커튼 주름: 사인 몇 개를 겹쳐 천천히 흐르게. 아래는 초록, 위로 가며 보라
const AURORA_FRAG = `
varying vec2 vUv; uniform float uTime; uniform float uStill; uniform float uGain; uniform float uSeed;
void main(){
    float x = vUv.x, y = vUv.y;
    float t = uTime * (1.0 - uStill * 0.9) + uSeed;
    float fold = 0.55 + 0.45 * sin(x * 18.0 + t * 0.35) * sin(x * 7.0 - t * 0.21 + 1.3);
    fold *= 0.7 + 0.3 * sin(x * 31.0 + t * 0.6);
    float bottom = smoothstep(0.0, 0.18, y);
    float top = 1.0 - smoothstep(0.35, 1.0, y);
    float wave = 0.6 + 0.4 * sin(x * 4.0 + t * 0.15);
    float a = bottom * top * fold * wave;
    float side = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.88, 1.0, x));
    a *= side * 0.5 * uGain;
    vec3 green = vec3(0.30, 0.95, 0.62), teal = vec3(0.25, 0.75, 0.85), purple = vec3(0.58, 0.32, 0.86);
    vec3 c = mix(green, teal, smoothstep(0.1, 0.5, y));
    c = mix(c, purple, smoothstep(0.4, 1.0, y));
    gl_FragColor = vec4(c, a);
}`;

const SEA_VERT = `
varying vec3 vWorld;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// 바다: 아주 어두운 남색 + 달빛 길(달 방향으로 길게) + 등대 쪽 반짝임 + 해안으로 밀려오는 잔물결
const SEA_FRAG = `
varying vec3 vWorld; uniform float uTime; uniform vec3 uCam; uniform vec2 uMoonDir; uniform vec3 uLamp; uniform float uLampOn; uniform float uStill;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
    vec2 d = vWorld.xz - uCam.xz;
    float dist = length(d);
    vec2 dir = d / max(dist, 0.001);
    float t = uTime * (1.0 - uStill * 0.9);
    // 잔물결 (가로 줄무늬가 해안으로)
    float ripple = 0.5 + 0.5 * sin(vWorld.z * 0.9 + t * 0.7 + sin(vWorld.x * 0.3) * 2.0);
    ripple *= 0.5 + 0.5 * sin(vWorld.z * 2.3 - t * 1.1 + vWorld.x * 0.4);
    vec3 base = vec3(0.025, 0.05, 0.11) + vec3(0.02, 0.04, 0.08) * ripple;
    // 달빛 길
    float along = dot(dir, uMoonDir);
    float perp = length(dir - uMoonDir * along);
    float path = exp(-perp * perp * 90.0) * smoothstep(0.2, 1.0, along);
    float sparkle = hash(floor(vWorld.xz * 1.7 + vec2(0.0, floor(t * 3.0)))) * hash(floor(vWorld.xz * 0.6));
    float glint = step(0.72, sparkle) * (0.5 + 0.5 * sin(t * 6.0 + vWorld.x * 3.0));
    base += vec3(0.95, 0.88, 0.70) * path * (0.08 + 0.22 * glint) * smoothstep(120.0, 20.0, dist);
    // 등대 비침 (등대 바로 아래로 길게)
    vec2 ld = vWorld.xz - uLamp.xz;
    float lamp = exp(-ld.x * ld.x * 0.12) * smoothstep(0.0, 18.0, ld.y) * smoothstep(40.0, 8.0, ld.y);
    base += vec3(1.0, 0.85, 0.55) * lamp * (0.05 + 0.2 * uLampOn) * (0.6 + 0.4 * glint);
    // 멀어질수록 하늘빛으로
    base = mix(base, vec3(0.06, 0.08, 0.18), smoothstep(40.0, 130.0, dist));
    gl_FragColor = vec4(base, 1.0);
}`;

// 돌고래 실루엣 (오른쪽을 보고 뛰어오르는 모양)
function dolphinTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = 192;
    c.height = 96;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, "#9fb4d8");
    grad.addColorStop(0.5, "#5a6f99");
    grad.addColorStop(1, "#2a3556");
    g.fillStyle = grad;
    g.beginPath();
    // 몸통: 꼬리(왼쪽) → 등 → 주둥이(오른쪽) → 배 → 꼬리
    g.moveTo(14, 54);
    g.bezierCurveTo(40, 22, 100, 14, 150, 30);
    g.bezierCurveTo(168, 36, 180, 44, 186, 50);
    g.bezierCurveTo(176, 56, 160, 62, 140, 64);
    g.bezierCurveTo(100, 76, 50, 72, 22, 62);
    g.closePath();
    g.fill();
    // 꼬리 지느러미
    g.beginPath();
    g.moveTo(22, 58);
    g.lineTo(4, 40);
    g.lineTo(16, 56);
    g.lineTo(4, 76);
    g.closePath();
    g.fill();
    // 등지느러미
    g.beginPath();
    g.moveTo(92, 24);
    g.bezierCurveTo(100, 6, 112, 6, 116, 22);
    g.closePath();
    g.fill();
    // 가슴지느러미
    g.beginPath();
    g.moveTo(120, 60);
    g.bezierCurveTo(118, 76, 108, 80, 104, 70);
    g.closePath();
    g.fill();
    // 달빛 받은 등 하이라이트
    g.strokeStyle = "rgba(230,240,255,0.55)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(44, 30);
    g.bezierCurveTo(90, 16, 130, 18, 160, 32);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function flameTexture(frame: number): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 128;
    const g = c.getContext("2d")!;
    const seed = frame * 1.7;
    const sway = Math.sin(seed) * 6;
    const h = 92 + Math.sin(seed * 2.3) * 10;
    const draw = (w: number, hh: number, col: string, alpha: number, dx: number) => {
        g.globalAlpha = alpha;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(48 + dx, 120);
        g.bezierCurveTo(48 - w + dx, 120, 48 - w * 0.9 + dx + sway * 0.3, 120 - hh * 0.55, 48 + dx + sway, 120 - hh);
        g.bezierCurveTo(48 + w * 0.9 + dx + sway * 0.3, 120 - hh * 0.55, 48 + w + dx, 120, 48 + dx, 120);
        g.closePath();
        g.fill();
    };
    draw(30, h, "#ff6a1a", 0.85, 0);
    draw(22, h * 0.78, "#ffa126", 0.9, Math.sin(seed * 3.1) * 3);
    draw(13, h * 0.5, "#ffe08a", 0.95, Math.sin(seed * 4.7) * 2);
    draw(6, h * 0.28, "#fff8dc", 1, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// 모닥불 불꽃 크기 (2026-11-15 1.5배로 키움)
const FLAME_W = 1.15, FLAME_H = 1.55;

export class Scenery {
    group = new THREE.Group();
    sky = new THREE.Group(); // 오로라처럼 하늘에 붙는 것 (HillScene 이 카메라를 따라 옮김)
    private auroraMats: THREE.ShaderMaterial[] = [];
    private seaMat: THREE.ShaderMaterial;
    private beam: THREE.Mesh;
    private lampGlow: THREE.Sprite;
    private lampHalo: THREE.Sprite;
    private flame: THREE.Sprite;
    private flameCore: THREE.Sprite;
    private smoke: { s: THREE.Sprite; born: number; life: number; drift: number }[] = [];
    private smokeTex: THREE.Texture;
    private flameFrames: THREE.Texture[];
    private fireGlow: THREE.Mesh;
    private embers: { s: THREE.Sprite; born: number; life: number; vx: number; vz: number }[] = [];
    private emberTex: THREE.Texture;
    private lastFlame = 0;
    private dolphinTex: THREE.Texture;
    private dolphins: { s: THREE.Sprite; splash: THREE.Sprite; born: number; life: number; x: number; z: number; dir: number }[] = [];
    private nextDolphin = 0;
    lampOn = 0; // 0~1, 등대 불빛이 카메라 쪽을 향한 정도 (소리·연출용)
    readonly firePos: THREE.Vector3;

    constructor(private opts: SceneryOpts, fireX: number, fireZ: number, fireY: number) {
        this.firePos = new THREE.Vector3(fireX, fireY, fireZ);

        // ---- 오로라 두 줄
        // 1) 왼쪽 뒤 하늘에 높은 커튼 (방위각 -150~-30도, 고도 14~48도. 돌아보면 보임)
        this.addAurora(-150, -30, 14, 48, 1, 0);
        // 2) 처음 들어오면 바로 보이게 정면 바다 위 수평선에 낮게 깔린 띠 (별자리·달 아래, 고도 3~22도)
        this.addAurora(-80, 80, 3, 22, 1.05, 37);

        // ---- 바다: 언덕 너머(z < -13) 넓게
        const lampPos = new THREE.Vector3(21, 5.6, -50);
        // 달빛 길 방향 = 달 방위(HillScene MOON_AZ 와 맞춤)
        const moonDir = new THREE.Vector2(Math.sin(-15 * Math.PI / 180), -Math.cos(-15 * Math.PI / 180)).normalize();
        this.seaMat = new THREE.ShaderMaterial({
            vertexShader: SEA_VERT,
            fragmentShader: SEA_FRAG,
            uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3(SKY_ORIGIN.x, SKY_ORIGIN.y, SKY_ORIGIN.z) }, uMoonDir: { value: moonDir }, uLamp: { value: lampPos }, uLampOn: { value: 0 }, uStill: { value: opts.reduceMotion ? 1 : 0 } },
        });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 1, 1), this.seaMat);
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(0, -0.9, 0);
        this.group.add(sea);

        // ---- 먼 곶 (등대가 서 있는 땅) + 등대
        const land = this.silhouette(6.1, "#070b1f", 70, 7, 1.2);
        land.position.set(30, 1.0, -58);
        this.group.add(land);
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 5, 10), new THREE.MeshBasicMaterial({ color: "#6b6a78" }));
        tower.position.set(lampPos.x, 2.5 + 0.6, lampPos.z);
        this.group.add(tower);
        for (const y of [1.9, 3.6]) {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.5, 10), new THREE.MeshBasicMaterial({ color: "#8c3a3a" }));
            band.position.set(lampPos.x, y + 0.6, lampPos.z);
            this.group.add(band);
        }
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 10), new THREE.MeshBasicMaterial({ color: "#3b3b4a" }));
        cap.position.set(lampPos.x, lampPos.y + 0.75, lampPos.z);
        this.group.add(cap);
        this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,230,170"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.lampGlow.position.copy(lampPos);
        this.lampGlow.scale.set(2.2, 2.2, 1);
        this.group.add(this.lampGlow);
        this.lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,220,150"), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.lampHalo.position.copy(lampPos);
        this.lampHalo.scale.set(14, 14, 1);
        this.group.add(this.lampHalo);
        // 빛살: 한쪽 끝이 등불에 붙은 긴 띠. y 축으로 돌림
        const beamTex = (() => {
            const c = document.createElement("canvas");
            c.width = 256;
            c.height = 32;
            const g = c.getContext("2d")!;
            const gr = g.createLinearGradient(0, 0, 256, 0);
            gr.addColorStop(0, "rgba(255,235,190,0.5)");
            gr.addColorStop(0.45, "rgba(255,225,170,0.14)");
            gr.addColorStop(1, "rgba(255,220,160,0)");
            g.fillStyle = gr;
            g.fillRect(0, 0, 256, 32);
            // 위아래 가장자리는 흐리게
            const vg = g.createLinearGradient(0, 0, 0, 32);
            vg.addColorStop(0, "rgba(0,0,0,1)");
            vg.addColorStop(0.5, "rgba(0,0,0,0)");
            vg.addColorStop(1, "rgba(0,0,0,1)");
            g.globalCompositeOperation = "destination-out";
            g.fillStyle = vg;
            g.fillRect(0, 0, 256, 32);
            g.globalCompositeOperation = "source-over";
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        })();
        const bg = new THREE.PlaneGeometry(44, 1.6);
        bg.translate(22, 0, 0);
        this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0.55 }));
        this.beam.position.copy(lampPos);
        this.group.add(this.beam);

        // ---- 모닥불: 장작 5개(원뿔로 기댐) + 불꽃 두 겹 + 바닥 불빛 + 불씨 + 옅은 연기
        const logMat = new THREE.MeshBasicMaterial({ color: "#3a2416" });
        const logMat2 = new THREE.MeshBasicMaterial({ color: "#2c1a10" });
        for (let i = 0; i < 5; i++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), i % 2 ? logMat2 : logMat);
            log.rotation.z = Math.PI / 2 - 0.42;
            log.rotation.y = (i * Math.PI * 2) / 5 + 0.3;
            log.position.set(fireX, fireY + 0.18, fireZ);
            this.group.add(log);
        }
        const stoneMat = new THREE.MeshBasicMaterial({ color: "#2a2f45" });
        const stoneMat2 = new THREE.MeshBasicMaterial({ color: "#363c58" });
        for (let i = 0; i < 11; i++) {
            const a = (i / 11) * Math.PI * 2;
            const st = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (i % 3) * 0.03, 6, 5), i % 2 ? stoneMat2 : stoneMat);
            st.position.set(fireX + Math.cos(a) * 0.92, fireY + 0.06, fireZ + Math.sin(a) * 0.92);
            st.scale.y = 0.6;
            this.group.add(st);
        }
        this.flameFrames = [0, 1, 2, 3, 4, 5].map(flameTexture);
        this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameFrames[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.flame.center.set(0.5, 0.06);
        this.flame.scale.set(FLAME_W, FLAME_H, 1);
        this.flame.position.set(fireX, fireY + 0.12, fireZ);
        this.group.add(this.flame);
        // 안쪽 작은 불꽃 (다른 그림으로 엇갈려 일렁여 깊이감)
        this.flameCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameFrames[3], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
        this.flameCore.center.set(0.5, 0.06);
        this.flameCore.scale.set(FLAME_W * 0.6, FLAME_H * 0.7, 1);
        this.flameCore.position.set(fireX, fireY + 0.14, fireZ + 0.02);
        this.group.add(this.flameCore);
        this.fireGlow = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), new THREE.MeshBasicMaterial({ map: glowTexture("255,150,70"), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.fireGlow.rotation.x = -Math.PI / 2;
        this.fireGlow.position.set(fireX, fireY + 0.04, fireZ);
        this.group.add(this.fireGlow);
        this.emberTex = glowTexture("255,170,90");
        this.smokeTex = glowTexture("150,150,170");
        this.dolphinTex = dolphinTexture();
        this.nextDolphin = 14 + Math.random() * 10;
    }

    // 돌고래 한 무리가 바다에서 뛰어올랐다 들어감 (정면 바다 어딘가, 25~45초마다)
    private spawnDolphins(now: number) {
        const n = 2 + Math.floor(Math.random() * 2);
        const baseAz = (Math.random() * 2 - 1) * 70; // 정면 기준 좌우
        const dist = 24 + Math.random() * 14;
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < n; k++) {
            const az = (baseAz + k * 4 * dir) * Math.PI / 180;
            const x = SKY_ORIGIN.x + Math.sin(az) * dist, z = SKY_ORIGIN.z - Math.cos(az) * dist;
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dolphinTex, transparent: true, depthWrite: false, opacity: 0.95 }));
            s.scale.set(2.2 * dir, 1.1, 1);
            s.position.set(x, -0.9, z);
            const splash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("200,225,255"), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
            splash.scale.set(2.4, 1.0, 1);
            splash.position.set(x, -0.8, z);
            this.group.add(s, splash);
            this.dolphins.push({ s, splash, born: now + k * 0.45, life: 1.6, x, z, dir });
        }
    }

    private updateDolphins(now: number, dt: number) {
        void dt;
        if (!this.opts.reduceMotion && now > this.nextDolphin && this.dolphins.length === 0) {
            this.spawnDolphins(now);
            this.nextDolphin = now + 25 + Math.random() * 20;
        }
        this.dolphins = this.dolphins.filter((d) => {
            const t = (now - d.born) / d.life;
            if (t < 0) return true;
            if (t >= 1) {
                this.group.remove(d.s, d.splash);
                d.s.material.dispose();
                d.splash.material.dispose();
                return false;
            }
            // 포물선으로 뛰어오름. 물 밑(-0.9)에서 시작해 1.6 까지
            const h = Math.sin(t * Math.PI) * 2.4 - 0.6;
            d.s.position.set(d.x + d.dir * (t - 0.5) * 3.2, h, d.z);
            d.s.material.rotation = -d.dir * (t - 0.5) * 1.6;
            (d.s.material as THREE.SpriteMaterial).opacity = h < -0.75 ? 0 : 0.95;
            // 들어갈 때·나올 때 물보라
            const near = Math.min(Math.abs(t - 0.08), Math.abs(t - 0.92));
            (d.splash.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.55 - near * 4);
            d.splash.position.set(d.x + d.dir * (t < 0.5 ? -1.4 : 1.4), -0.7, d.z);
            return true;
        });
    }

    private silhouette(seed: number, color: string, w: number, h: number, bump: number): THREE.Mesh {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 128;
        const x = c.getContext("2d")!;
        x.fillStyle = color;
        x.beginPath();
        x.moveTo(0, 128);
        for (let i = 0; i <= 512; i += 8) {
            const t = i / 512;
            x.lineTo(i, 96 - bump * (18 * Math.sin(t * 2.2 + seed) + 10 * Math.sin(t * 6.1 + seed * 2) + 5 * Math.sin(t * 13 + seed * 3)) - (1 - Math.abs(t - 0.5) * 2) * 24);
        }
        x.lineTo(512, 128);
        x.closePath();
        x.fill();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    }

    // 하늘에 오로라 띠 하나 (방위각 h0~h1, 고도 v0~v1, 밝기 gain, 무늬 seed)
    private addAurora(h0: number, h1: number, v0: number, v1: number, gain: number, seed: number) {
        const seg = 64, rows = 6;
        const pos = new Float32Array((seg + 1) * (rows + 1) * 3), uv = new Float32Array((seg + 1) * (rows + 1) * 2), idx: number[] = [];
        for (let r = 0; r <= rows; r++) {
            for (let s = 0; s <= seg; s++) {
                const h = h0 + ((h1 - h0) * s) / seg;
                const v = v0 + ((v1 - v0) * r) / rows + Math.sin(s * 0.5 + seed) * 2.5 * ((v1 - v0) / 34);
                const p = fromAngles(h, v, DOME_R * 1.18);
                const i = r * (seg + 1) + s;
                pos[i * 3] = p.x;
                pos[i * 3 + 1] = p.y;
                pos[i * 3 + 2] = p.z;
                uv[i * 2] = s / seg;
                uv[i * 2 + 1] = r / rows;
                if (r < rows && s < seg) idx.push(i, i + 1, i + seg + 1, i + 1, i + seg + 2, i + seg + 1);
            }
        }
        const ag = new THREE.BufferGeometry();
        ag.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        ag.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        ag.setIndex(idx);
        const mat = new THREE.ShaderMaterial({
            vertexShader: AURORA_VERT,
            fragmentShader: AURORA_FRAG,
            uniforms: { uTime: { value: 0 }, uStill: { value: this.opts.reduceMotion ? 1 : 0 }, uGain: { value: gain }, uSeed: { value: seed } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });
        const aurora = new THREE.Mesh(ag, mat);
        aurora.frustumCulled = false;
        this.sky.add(aurora);
        this.auroraMats.push(mat);
    }

    update(now: number, dt: number, camYaw: number) {
        for (const m of this.auroraMats) m.uniforms.uTime.value = now;
        this.seaMat.uniforms.uTime.value = now;
        // 등대: 7초에 한 바퀴. 빛살이 카메라(+z) 쪽을 지날 때 등불이 번쩍
        const ang = this.opts.reduceMotion ? Math.PI / 2 : (now * (Math.PI * 2)) / 7;
        this.beam.rotation.y = -ang;
        // 빛살 방향 (cos ang, 0, sin ang) 과 카메라 쪽 (0,0,1) 의 내적
        const facing = Math.max(0, Math.sin(ang));
        this.lampOn = Math.pow(facing, 6);
        (this.lampHalo.material as THREE.SpriteMaterial).opacity = this.lampOn * 0.55;
        const lg = 2.2 + this.lampOn * 2.5;
        this.lampGlow.scale.set(lg, lg, 1);
        this.seaMat.uniforms.uLampOn.value = this.lampOn;
        void camYaw;

        this.updateDolphins(now, dt);

        // 불꽃: 90ms 마다 다음 그림 + 살짝 흔들림
        if (now - this.lastFlame > 0.09) {
            this.lastFlame = now;
            const fm = this.flame.material as THREE.SpriteMaterial;
            fm.map = this.flameFrames[Math.floor(Math.random() * this.flameFrames.length)];
            fm.needsUpdate = true;
            const cm = this.flameCore.material as THREE.SpriteMaterial;
            cm.map = this.flameFrames[Math.floor(Math.random() * this.flameFrames.length)];
            cm.needsUpdate = true;
        }
        const flick = this.opts.reduceMotion ? 1 : 0.92 + 0.08 * Math.sin(now * 13.1) + 0.05 * Math.sin(now * 7.3);
        this.flame.scale.set(FLAME_W * (0.95 + (1 - flick) * 0.6), FLAME_H * flick, 1);
        const flick2 = this.opts.reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(now * 17.3 + 1.1);
        this.flameCore.scale.set(FLAME_W * 0.6 * (1.05 - (flick2 - 0.9)), FLAME_H * 0.7 * flick2, 1);
        (this.fireGlow.material as THREE.MeshBasicMaterial).opacity = 0.36 + 0.1 * flick + (this.opts.reduceMotion ? 0 : 0.05 * Math.sin(now * 9.7));

        // 연기: 아주 옅게, 천천히 올라가며 퍼짐
        if (!this.opts.reduceMotion && this.smoke.length < (this.opts.isMobile ? 4 : 6) && Math.random() < dt * 1.2) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false }));
            s.position.set(this.firePos.x + (Math.random() - 0.5) * 0.2, this.firePos.y + FLAME_H * 0.9, this.firePos.z);
            this.group.add(s);
            this.smoke.push({ s, born: now, life: 4 + Math.random() * 2, drift: (Math.random() - 0.5) * 0.2 });
        }
        this.smoke = this.smoke.filter((m) => {
            const t = (now - m.born) / m.life;
            if (t >= 1) {
                this.group.remove(m.s);
                m.s.material.dispose();
                return false;
            }
            m.s.position.y += dt * 0.45;
            m.s.position.x += (m.drift + 0.08) * dt;
            const sz = 0.5 + t * 1.6;
            m.s.scale.set(sz, sz, 1);
            m.s.material.opacity = 0.12 * Math.sin(Math.PI * t);
            return true;
        });

        // 불씨: 가끔 하나 띄워 위로 흩날림
        if (!this.opts.reduceMotion && this.embers.length < (this.opts.isMobile ? 10 : 16) && Math.random() < dt * 5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.emberTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
            s.scale.set(0.1, 0.1, 1);
            s.position.set(this.firePos.x + (Math.random() - 0.5) * 0.5, this.firePos.y + 0.75, this.firePos.z + (Math.random() - 0.5) * 0.5);
            this.group.add(s);
            this.embers.push({ s, born: now, life: 1.4 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 0.25, vz: (Math.random() - 0.5) * 0.25 });
        }
        this.embers = this.embers.filter((e) => {
            const t = (now - e.born) / e.life;
            if (t >= 1) {
                this.group.remove(e.s);
                e.s.material.dispose();
                return false;
            }
            e.s.position.y += dt * (0.9 + t * 0.4);
            e.s.position.x += (e.vx + Math.sin(now * 5 + e.born) * 0.3) * dt;
            e.s.position.z += e.vz * dt;
            (e.s.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - t) * (0.6 + 0.4 * Math.sin(now * 20 + e.born * 7));
            return true;
        });
    }

    dispose() {
        this.dolphinTex.dispose();
        for (const f of this.flameFrames) f.dispose();
        for (const e of this.embers) e.s.material.dispose();
        for (const m of this.smoke) m.s.material.dispose();
        this.smokeTex.dispose();
    }
}
