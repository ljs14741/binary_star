// 실제 하늘과 맞추는 것들: 달 모양(위상), 눈 오는 계절. 날짜만으로 계산 (서버·외부 API 없이)

const SYNODIC_DAYS = 29.530588853; // 삭망월
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 기준 삭

// 0 = 삭(안 보임), 0.25 = 상현, 0.5 = 보름, 0.75 = 하현
export function moonPhase(d: Date = new Date()): number {
    const days = (d.getTime() - KNOWN_NEW_MOON) / 86_400_000;
    return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

// 밝은 부분 비율 0~1
export function moonIllumination(phase: number): number {
    return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

// 한국 시간 11~2월엔 눈 (3월쯤 실제 날씨로 바꿀 예정)
export function isSnowSeason(d: Date = new Date()): boolean {
    const m = new Date(d.getTime() + 9 * 3600 * 1000).getUTCMonth() + 1;
    return m >= 11 || m <= 2;
}
