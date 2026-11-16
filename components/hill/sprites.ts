// 실루엣·국기·구역 이름을 캔버스에 그려 three.js 텍스처로. 외부 이미지 없음
import * as THREE from "three";


function canvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}

function makeTexture(c: HTMLCanvasElement): THREE.Texture {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
}

export type CreatureKind = "idle" | "blink" | "lookup" | "walk1" | "walk2" | "happy" | "wave1" | "wave2" | "sad";
export const CREATURE_KINDS: CreatureKind[] = ["idle", "blink", "lookup", "walk1", "walk2", "happy", "wave1", "wave2", "sad"];
export type Palette = { body: string; shade: string; glow: string };

// 다른 사람 색 (id 로 돌려 씀). 나는 따뜻한 노랑
export const PALETTES: Palette[] = [
    { body: "#cdbfff", shade: "#9f8ae6", glow: "180,160,255" },
    { body: "#b4ecdd", shade: "#7fcbb6", glow: "150,230,210" },
    { body: "#ffd2bd", shade: "#f0a98a", glow: "255,190,160" },
    { body: "#b9dcff", shade: "#86b6ee", glow: "160,200,255" },
    { body: "#ffc4d8", shade: "#ee93b4", glow: "255,170,200" },
    { body: "#e6e2ff", shade: "#b7b0e8", glow: "210,205,255" },
];
export const ME_PALETTE: Palette = { body: "#ffe9a6", shade: "#f2c75c", glow: "255,216,107" };

// 별 요정: 둥글고 살짝 빛나는 몸, 큰 눈, 볼, 짧은 팔, 머리 위 작은 별. 128x128, 아래 가운데가 발
export function creatureTexture(kind: CreatureKind, pal: Palette): THREE.Texture {
    const c = canvas(128, 128);
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 128, 128);
    const walk = kind === "walk1" || kind === "walk2";
    const wave = kind === "wave1" || kind === "wave2";
    const sx = kind === "walk1" ? 0.94 : kind === "walk2" ? 1.06 : 1;
    const sy = kind === "walk1" ? 1.06 : kind === "walk2" ? 0.95 : 1;
    const cx = 64, cy = 74, r = 30;
    // 몸 뒤 은은한 빛
    const halo = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.9);
    halo.addColorStop(0, `rgba(${pal.glow},0.35)`);
    halo.addColorStop(1, `rgba(${pal.glow},0)`);
    g.fillStyle = halo;
    g.fillRect(0, 0, 128, 128);
    g.save();
    g.translate(cx, cy);
    g.scale(sx, sy);
    // 팔
    g.strokeStyle = pal.shade;
    g.lineWidth = 7;
    g.lineCap = "round";
    const sad = kind === "sad";
    const armY = walk ? -2 : sad ? 12 : 4; // 슬프면 팔이 축 처짐
    const armOut = walk ? 1.25 : 1;
    g.beginPath();
    g.moveTo(-r * 0.75, 2);
    g.lineTo(-r * 1.05 * armOut, armY + (kind === "walk2" ? 8 : 0));
    g.moveTo(r * 0.75, 2);
    if (wave) {
        // 오른팔을 번쩍 들어 좌우로 흔듦 (wave1 ↔ wave2 번갈아)
        const tilt = kind === "wave1" ? -0.35 : 0.25;
        g.lineTo(r * (0.95 + tilt * 0.4), -r * 0.45);
        g.lineTo(r * (1.15 + tilt), -r * 1.2);
    } else g.lineTo(r * 1.05 * armOut, armY + (kind === "walk1" ? 8 : 0));
    g.stroke();
    // 몸 (물방울처럼 위가 살짝 뾰족)
    const body = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.35, pal.body);
    body.addColorStop(1, pal.shade);
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(0, -r * 1.25);
    g.bezierCurveTo(r * 0.9, -r * 1.05, r * 1.05, r * 0.2, r * 0.75, r * 0.8);
    g.bezierCurveTo(r * 0.45, r * 1.08, -r * 0.45, r * 1.08, -r * 0.75, r * 0.8);
    g.bezierCurveTo(-r * 1.05, r * 0.2, -r * 0.9, -r * 1.05, 0, -r * 1.25);
    g.closePath();
    g.fill();
    // 머리 위 작은 별
    g.fillStyle = "#fff6cf";
    star5(g, 0, -r * 1.42, 5.5, 2.4);
    // 눈
    const ey = kind === "lookup" ? -r * 0.35 : -r * 0.15;
    const ex = r * 0.36;
    g.fillStyle = "#1b1a2e";
    if (kind === "blink" || kind === "happy") {
        g.strokeStyle = "#1b1a2e";
        g.lineWidth = 3.2;
        g.beginPath();
        if (kind === "happy") {
            g.arc(-ex, ey + 1, 5.5, Math.PI * 1.15, Math.PI * 1.85);
            g.moveTo(ex + 5.5, ey + 1);
            g.arc(ex, ey + 1, 5.5, Math.PI * 1.15, Math.PI * 1.85);
        } else {
            g.moveTo(-ex - 5, ey);
            g.lineTo(-ex + 5, ey);
            g.moveTo(ex - 5, ey);
            g.lineTo(ex + 5, ey);
        }
        g.stroke();
    } else {
        for (const sgn of [-1, 1]) {
            g.beginPath();
            g.ellipse(sgn * ex, ey, 5.2, 6.4, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#ffffff";
            g.beginPath();
            g.arc(sgn * ex - 1.8, ey - 2.4, 1.9, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#1b1a2e";
        }
    }
    // 슬픔: 가운데가 올라간 눈썹 + 한쪽 눈 아래 눈물
    if (sad) {
        g.strokeStyle = "#1b1a2e";
        g.lineWidth = 2.4;
        g.beginPath();
        for (const sgn of [-1, 1]) {
            g.moveTo(sgn * (ex - 6), ey - 12.5);
            g.lineTo(sgn * (ex + 6), ey - 8.5);
        }
        g.stroke();
        g.fillStyle = "#8fd8ff";
        g.beginPath();
        const tx = -ex - 1, ty = ey + 8;
        g.moveTo(tx, ty);
        g.bezierCurveTo(tx + 4.5, ty + 6, tx + 4, ty + 11, tx, ty + 11);
        g.bezierCurveTo(tx - 4, ty + 11, tx - 4.5, ty + 6, tx, ty);
        g.fill();
        g.fillStyle = "#1b1a2e";
    }
    // 볼
    g.fillStyle = "rgba(255,120,150,0.35)";
    for (const sgn of [-1, 1]) {
        g.beginPath();
        g.ellipse(sgn * r * 0.62, ey + 9, 5, 3.2, 0, 0, Math.PI * 2);
        g.fill();
    }
    // 입
    g.strokeStyle = "#1b1a2e";
    g.lineWidth = 2;
    g.beginPath();
    if (kind === "happy" || wave) g.arc(0, ey + 9, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (sad) g.arc(0, ey + 14, 4, 1.2 * Math.PI, 1.8 * Math.PI); // 시무룩한 입
    else g.arc(0, ey + 8, 2.4, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    g.restore();
    return makeTexture(c);
}

// 풍등: 아래가 좁은 종이등, 안쪽에서 주황빛
export function lanternTexture(): THREE.Texture {
    const c = canvas(64, 80);
    const g = c.getContext("2d")!;
    const halo = g.createRadialGradient(32, 42, 4, 32, 42, 34);
    halo.addColorStop(0, "rgba(255,190,110,0.55)");
    halo.addColorStop(1, "rgba(255,190,110,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 64, 80);
    const body = g.createLinearGradient(0, 18, 0, 66);
    body.addColorStop(0, "#ffe6b0");
    body.addColorStop(0.6, "#ffb45e");
    body.addColorStop(1, "#ff8a3d");
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(20, 18);
    g.quadraticCurveTo(32, 12, 44, 18);
    g.lineTo(41, 62);
    g.quadraticCurveTo(32, 66, 23, 62);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,250,220,0.9)";
    g.beginPath();
    g.ellipse(32, 60, 4, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    return makeTexture(c);
}

function star5(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? R : r;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
}

// 공감했을 때 머리 위로 올라가는 작은 하트
export function heartTexture(color = "#ff9bb3"): THREE.Texture {
    const c = canvas(64, 64);
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(32, 54);
    g.bezierCurveTo(10, 38, 6, 22, 18, 14);
    g.bezierCurveTo(26, 9, 32, 16, 32, 20);
    g.bezierCurveTo(32, 16, 38, 9, 46, 14);
    g.bezierCurveTo(58, 22, 54, 38, 32, 54);
    g.fill();
    return makeTexture(c);
}

// 발밑 빛 (내 자리 표시·앉은 자리 은은한 빛)
export function glowTexture(color = "255,216,107"): THREE.Texture {
    const c = canvas(128, 128);
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, `rgba(${color},0.9)`);
    r.addColorStop(0.35, `rgba(${color},0.35)`);
    r.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return makeTexture(c);
}

// 실제 위상의 달. phase 0 = 삭, 0.5 = 보름 (북반구 기준: 차오를 땐 오른쪽이 밝음)
// 어두운 부분도 지구빛으로 희미하게 그려서 그믐에도 "달에게 소원" 자리가 사라지지 않게 함
export function moonTexture(phase: number): THREE.Texture {
    const S = 128,
        cx = 64,
        cy = 64,
        r = 40;
    const c = canvas(S, S);
    const g = c.getContext("2d")!;
    // 둘레 은은한 빛
    const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, 64);
    halo.addColorStop(0, "rgba(255,244,214,0.22)");
    halo.addColorStop(1, "rgba(255,244,214,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    // 지구빛 (어두운 쪽)
    g.fillStyle = "rgba(150,160,200,0.28)";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    // 밝은 쪽: 바깥 반원 + 명암 경계(타원 반쪽)
    const k = Math.cos(phase * Math.PI * 2); // 1 = 삭, -1 = 보름
    const lit = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    lit.addColorStop(0, "rgba(255,250,232,1)");
    lit.addColorStop(1, "rgba(246,232,196,1)");
    g.save();
    if (phase > 0.5) {
        // 기울 땐 왼쪽이 밝음
        g.translate(S, 0);
        g.scale(-1, 1);
    }
    g.fillStyle = lit;
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    // k>0 초승: 경계가 오른쪽으로 불룩 / k<0 상현 넘김: 왼쪽으로 불룩
    g.ellipse(cx, cy, Math.max(0.01, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    g.fill();
    g.restore();
    // 바다(어두운 무늬) 몇 개. 밝은 쪽에만 보이게 위에 겹침
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(150,140,120,0.16)";
    for (const [x, y, rr] of [
        [-10, -12, 9],
        [8, -4, 7],
        [-4, 10, 8],
        [14, 14, 5],
    ] as const) {
        g.beginPath();
        g.arc(cx + x, cy + y, rr, 0, Math.PI * 2);
        g.fill();
    }
    g.globalCompositeOperation = "source-over";
    return makeTexture(c);
}

// 글자 스프라이트 (별자리 이름 등). "\n" 으로 여러 줄
export function textTexture(text: string, opts: { size?: number; color?: string; font?: string; pad?: number } = {}): { tex: THREE.Texture; aspect: number } {
    const size = opts.size ?? 48;
    let family = "system-ui, sans-serif";
    try {
        family = getComputedStyle(document.body).fontFamily || family;
    } catch {}
    const font = `${opts.font ?? "600"} ${size}px ${family}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
    const lines = text.split("\n");
    const m = canvas(16, 16).getContext("2d")!;
    m.font = font;
    const w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width))) + (opts.pad ?? 16);
    const lh = size * 1.25;
    const h = Math.ceil(lh * lines.length + size * 0.3);
    const c = canvas(w, h);
    const g = c.getContext("2d")!;
    g.font = font;
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = opts.color ?? "#ffffff";
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = size * 0.18;
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
    return { tex: makeTexture(c), aspect: w / h };
}

// 긴 이름은 가운데 가까운 띄어쓰기·가운뎃점에서 두 줄로
export function wrapTitle(title: string, maxChars: number): string {
    if (title.length <= maxChars) return title;
    const mid = title.length / 2;
    let best = -1, bestD = Infinity;
    for (let i = 1; i < title.length - 1; i++) {
        const ch = title[i];
        if (ch === " " || ch === "·" || ch === "、" || ch === "，") {
            const d = Math.abs(i - mid);
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
    }
    if (best < 0) return title.slice(0, Math.ceil(mid)) + "\n" + title.slice(Math.ceil(mid));
    const ch = title[best];
    return ch === " " ? title.slice(0, best) + "\n" + title.slice(best + 1) : title.slice(0, best + 1) + "\n" + title.slice(best + 1);
}

export function flagEmoji(code: string | null): string {
    if (!code || code.length !== 2) return "";
    return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
