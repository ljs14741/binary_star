// 지역 이름 다듬기·번역. DB-IP 무료판은 한국을 동 단위 영문("Yongsan-dong (Hangang-daero)")으로 주고 정확도도 낮아서,
// 한국·일본은 시도/도도부현 단위로 저장하고, 보여 줄 땐 언어별 이름으로 바꿈. DB 에는 영문 그대로 저장
import type { Lang } from "./i18n/config";
import type { Geo } from "./geo";

// DB-IP 결과 → 저장할 지역 이름 하나
export function pickPlace(country: string | null, city: string | null, subdivision: string | null): string | null {
    const clean = (s: string | null) => (s ? s.replace(/\s*\(.*?\)\s*/g, "").trim() || null : null);
    if (country === "KR" || country === "JP") return clean(subdivision) || clean(city);
    return clean(city) || clean(subdivision);
}

// 한국 17개 시·도 (DB-IP 영문 표기의 변형을 흡수하려고 키를 정규화)
const KR: Record<string, [string, string, string]> = {
    seoul: ["서울", "ソウル", "首爾"], busan: ["부산", "釜山", "釜山"], daegu: ["대구", "大邱", "大邱"], incheon: ["인천", "仁川", "仁川"],
    gwangju: ["광주", "光州", "光州"], daejeon: ["대전", "大田", "大田"], ulsan: ["울산", "蔚山", "蔚山"], sejong: ["세종", "世宗", "世宗"],
    gyeonggi: ["경기", "京畿", "京畿"], gangwon: ["강원", "江原", "江原"], chungcheongbuk: ["충북", "忠清北道", "忠清北道"], chungcheongnam: ["충남", "忠清南道", "忠清南道"],
    jeollabuk: ["전북", "全羅北道", "全羅北道"], jeollanam: ["전남", "全羅南道", "全羅南道"], gyeongsangbuk: ["경북", "慶尚北道", "慶尚北道"], gyeongsangnam: ["경남", "慶尚南道", "慶尚南道"],
    jeju: ["제주", "済州", "濟州"],
};
// 일본 주요 도도부현
const JP: Record<string, [string, string, string]> = {
    tokyo: ["도쿄", "東京", "東京"], osaka: ["오사카", "大阪", "大阪"], kyoto: ["교토", "京都", "京都"], hokkaido: ["홋카이도", "北海道", "北海道"],
    fukuoka: ["후쿠오카", "福岡", "福岡"], aichi: ["아이치", "愛知", "愛知"], kanagawa: ["가나가와", "神奈川", "神奈川"], hyogo: ["효고", "兵庫", "兵庫"],
    saitama: ["사이타마", "埼玉", "埼玉"], chiba: ["지바", "千葉", "千葉"], okinawa: ["오키나와", "沖縄", "沖繩"], hiroshima: ["히로시마", "広島", "廣島"],
};
// 대만 주요 도시
const TW: Record<string, [string, string, string]> = {
    taipei: ["타이베이", "台北", "台北"], "new taipei": ["신베이", "新北", "新北"], taichung: ["타이중", "台中", "台中"], kaohsiung: ["가오슝", "高雄", "高雄"],
    tainan: ["타이난", "台南", "台南"], taoyuan: ["타오위안", "桃園", "桃園"], hsinchu: ["신주", "新竹", "新竹"],
};

function norm(s: string): string {
    let k = s.toLowerCase().trim();
    k = k.replace(/\s*(special|metropolitan|self-governing|autonomous)?\s*(city|province|prefecture|county|metropolis)\b/g, "").replace(/-(do|si|fu|ken|to)$/g, "").replace(/\s+/g, " ").trim();
    // "north chungcheong" 꼴 → chungcheongbuk
    const m = k.match(/^(north|south) (\w+)$/);
    if (m) k = m[2] + (m[1] === "north" ? "buk" : "nam");
    return k;
}

const IDX: Record<Lang, number | null> = { ko: 0, ja: 1, "zh-TW": 2, en: null };

// 저장된 영문 지역 이름 → 보는 사람 언어. 모르는 이름은 영문 그대로
export function placeName(city: string | null | undefined, country: string | null | undefined, lang: Lang): string | null {
    if (!city) return null;
    const i = IDX[lang];
    if (i == null) return city;
    const table = country === "KR" ? KR : country === "JP" ? JP : country === "TW" ? TW : null;
    if (!table) return city;
    const hit = table[norm(city)];
    return hit ? hit[i] : city;
}

// 쓰는 사람이 직접 고르는 한국 지역. key 는 DB-IP 영문 표기와 같게 (placeName 으로 번역됨). 좌표는 지구본용 중심
export const KR_REGIONS: { key: string; lat: number; lng: number }[] = [
    { key: "Seoul", lat: 37.6, lng: 127.0 }, { key: "Gyeonggi-do", lat: 37.4, lng: 127.5 }, { key: "Incheon", lat: 37.5, lng: 126.7 },
    { key: "Busan", lat: 35.2, lng: 129.1 }, { key: "Daegu", lat: 35.9, lng: 128.6 }, { key: "Gwangju", lat: 35.2, lng: 126.9 },
    { key: "Daejeon", lat: 36.4, lng: 127.4 }, { key: "Ulsan", lat: 35.5, lng: 129.3 }, { key: "Sejong", lat: 36.5, lng: 127.3 },
    { key: "Gangwon-do", lat: 37.8, lng: 128.2 }, { key: "Chungcheongbuk-do", lat: 36.6, lng: 127.5 }, { key: "Chungcheongnam-do", lat: 36.7, lng: 126.7 },
    { key: "Jeollabuk-do", lat: 35.7, lng: 127.2 }, { key: "Jeollanam-do", lat: 34.9, lng: 127.0 }, { key: "Gyeongsangbuk-do", lat: 36.5, lng: 128.9 },
    { key: "Gyeongsangnam-do", lat: 35.5, lng: 128.2 }, { key: "Jeju-do", lat: 33.5, lng: 126.5 },
];

// 추정 지역 → 사람이 고른 지역으로 덮어씀. undefined/모르는 값이면 추정 그대로, "" 이면 지역 숨김(나라만)
export function applyRegion(geo: Geo, region: string | null | undefined): Geo {
    if (region == null) return geo;
    if (region === "") return { ...geo, city: null };
    const r = KR_REGIONS.find((x) => x.key === region);
    if (!r) return geo;
    return { country: "KR", city: r.key, lat: r.lat, lng: r.lng };
}
