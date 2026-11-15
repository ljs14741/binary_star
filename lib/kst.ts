// 한국 시간 날짜 헬퍼 (통계는 KST 하루 기준)
export function kstDay(d: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// KST 날짜(yyyy-mm-dd)의 0시를 UTC Date 로
export function kstDayStart(day: string): Date {
    return new Date(`${day}T00:00:00+09:00`);
}

// 오늘부터 n일 전까지 날짜 목록 (오래된 순)
export function lastDays(n: number): string[] {
    const out: string[] = [];
    const now = Date.now();
    for (let i = n - 1; i >= 0; i--) out.push(kstDay(new Date(now - i * 86_400_000)));
    return out;
}
