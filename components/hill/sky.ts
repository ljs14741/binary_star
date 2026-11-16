// 하늘 배치: 별자리 12개를 카메라 둘레 360도에 고리로. 카메라는 제자리에서 돌아봄
// 각도는 카메라 자리(SKY_ORIGIN) 기준. 방위각 az(도, 0 = 정면 바다, 오른쪽 +), 고도 elev(도)
export const DOME_R = 60;
export const SKY_ORIGIN = { x: 0, y: 2.6, z: 11.5 }; // 카메라 자리
export const SKY_V_CENTER = 12; // 카메라가 보는 세로각(도). 아래로 요정들, 위로 별자리
export const RING_STEP = 30; // 별자리 사이 방위각
export const RING_ELEV = [25, 31]; // 번갈아 높낮이 (폰 화면 위쪽 글자와 안 겹치게)
export const RING_HALF = 9.5; // 별자리 반지름(도)

export type StarPos = { x: number; y: number; z: number };
export type Cell = { az: number; elev: number; half: number };

const DEG = Math.PI / 180;

export function fromAngles(azDeg: number, elevDeg: number, r = DOME_R): StarPos {
    const az = azDeg * DEG, el = elevDeg * DEG;
    return { x: SKY_ORIGIN.x + r * Math.cos(el) * Math.sin(az), y: SKY_ORIGIN.y + r * Math.sin(el), z: SKY_ORIGIN.z - r * Math.cos(el) * Math.cos(az) };
}

// 세로 화각(도)·화면 비율 → 가로 화각(도)
export function hfovOf(vfovDeg: number, aspect: number): number {
    return (2 * Math.atan(Math.tan((vfovDeg / 2) * DEG) * aspect)) / DEG;
}

// n 개 칸을 고리로 (0번이 offset 방위). 12개면 30도 간격
export function ringLayout(n: number, offset = 0): Cell[] {
    const out: Cell[] = [];
    const step = n > 0 ? 360 / n : RING_STEP;
    for (let i = 0; i < n; i++) out.push({ az: offset + i * step, elev: RING_ELEV[i % RING_ELEV.length], half: RING_HALF });
    return out;
}

// 모양 좌표(-1~1) → 돔 위 좌표. 별자리 중심의 접평면 위에 놓아서 화면에서 안 찌그러짐
export function starPoint(cell: Cell, px: number, py: number, scale = 1, r = DOME_R): StarPos {
    const az = cell.az * DEG, el = cell.elev * DEG;
    // 중심 방향, 오른쪽, 위 벡터
    const cx = Math.cos(el) * Math.sin(az), cy = Math.sin(el), cz = -Math.cos(el) * Math.cos(az);
    const rx = Math.cos(az), ry = 0, rz = Math.sin(az);
    const ux = -Math.sin(el) * Math.sin(az), uy = Math.cos(el), uz = Math.sin(el) * Math.cos(az);
    const k = Math.tan(cell.half * scale * DEG);
    const dx = cx + rx * px * k + ux * py * k * 0.92, dy = cy + ry * px * k + uy * py * k * 0.92, dz = cz + rz * px * k + uz * py * k * 0.92;
    const len = Math.hypot(dx, dy, dz);
    return { x: SKY_ORIGIN.x + (dx / len) * r, y: SKY_ORIGIN.y + (dy / len) * r, z: SKY_ORIGIN.z + (dz / len) * r };
}

// 두 방위각 차이 (-180~180)
export function azDelta(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

// 공감 수 → 별 크기·밝기
export function starSize(count: number): number {
    return 1.6 + Math.log2(count + 1) * 0.9;
}
export function starAlpha(count: number): number {
    return Math.min(1, 0.5 + Math.log2(count + 1) * 0.12);
}
