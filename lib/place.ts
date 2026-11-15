// 지역 이름 다듬기. DB-IP 무료판은 한국을 동 단위 영문("Yongsan-dong (Hangang-daero)")으로 주고 정확도도 낮아서(통신사 교환국 기준),
// 한국·일본은 시도 단위로 저장. 화면엔 나라만 보여 주고(도시는 안 보여 줌) 지역은 관리 통계용으로만 남김
export function pickPlace(country: string | null, city: string | null, subdivision: string | null): string | null {
    const clean = (s: string | null) => (s ? s.replace(/\s*\(.*?\)\s*/g, "").trim() || null : null);
    if (country === "KR" || country === "JP") return clean(subdivision) || clean(city);
    return clean(city) || clean(subdivision);
}
