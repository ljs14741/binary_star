// 황도 12궁 별자리. 하늘에는 12개가 늘 전부 떠 있고, 주제 방은 어울리는 별자리에 붙음(주제 없는 별자리는 흐리게)
// 점은 -1~1 정사각형 안 좌표(x 오른쪽, y 위), 선은 점 번호 쌍. 점 순서 = 밝은 별(공감 많은 이야기)부터. 모양은 실제 별자리를 단순화한 것
import type { Lang } from "@/lib/i18n/config";

export type Shape = { name: string; symbol: string; names: Record<Lang, string>; points: [number, number][]; lines: [number, number][] };

export const ZODIAC: Shape[] = [
    { name: "aries", symbol: "♈", names: { ko: "양자리", en: "Aries", ja: "おひつじ座", "zh-TW": "牡羊座" },
      points: [[0.8, 0.3], [0.4, -0.1], [0.2, -0.3], [-0.3, -0.5], [-0.7, -0.4], [-0.95, -0.1], [0.95, 0.65], [0.6, 0.85], [-0.1, 0.45], [-0.6, 0.15]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [6, 7], [8, 1], [9, 4]] },
    { name: "taurus", symbol: "♉", names: { ko: "황소자리", en: "Taurus", ja: "おうし座", "zh-TW": "金牛座" },
      points: [[-0.1, -0.1], [-0.35, -0.35], [-0.6, -0.55], [-0.4, 0.15], [-0.7, 0.35], [0.6, 0.75], [0.85, -0.35], [-0.95, 0.75], [0.3, 0.3], [0.3, -0.2]],
      lines: [[0, 1], [1, 2], [0, 3], [3, 4], [0, 8], [8, 5], [0, 9], [9, 6], [4, 7]] },
    { name: "gemini", symbol: "♊", names: { ko: "쌍둥이자리", en: "Gemini", ja: "ふたご座", "zh-TW": "雙子座" },
      points: [[0.55, 0.9], [-0.35, 0.95], [0.45, 0.4], [0.5, -0.1], [0.6, -0.6], [0.4, -0.95], [-0.4, 0.45], [-0.55, -0.05], [-0.7, -0.55], [-0.9, -0.9]],
      lines: [[0, 2], [2, 3], [3, 4], [4, 5], [1, 6], [6, 7], [7, 8], [8, 9], [2, 6]] },
    { name: "cancer", symbol: "♋", names: { ko: "게자리", en: "Cancer", ja: "かに座", "zh-TW": "巨蟹座" },
      points: [[0, 0], [0.5, 0.6], [-0.55, 0.55], [0.1, -0.5], [0.3, -0.95], [-0.2, -0.9], [0.85, 0.9], [-0.9, 0.85], [0.1, 0.45], [-0.3, -0.3]],
      lines: [[0, 1], [0, 2], [0, 3], [3, 4], [3, 5], [1, 6], [2, 7], [8, 0], [9, 3]] },
    { name: "leo", symbol: "♌", names: { ko: "사자자리", en: "Leo", ja: "しし座", "zh-TW": "獅子座" },
      points: [[0.35, -0.75], [0.35, -0.25], [0.5, 0.3], [0.3, 0.75], [-0.05, 0.9], [-0.3, 0.65], [-0.95, -0.5], [-0.6, 0.2], [-0.3, -0.55], [0, -0.95]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 7], [7, 6], [6, 8], [8, 0], [9, 0]] },
    { name: "virgo", symbol: "♍", names: { ko: "처녀자리", en: "Virgo", ja: "おとめ座", "zh-TW": "處女座" },
      points: [[0.1, -0.95], [0, -0.4], [-0.2, 0.1], [-0.55, 0.45], [-0.9, 0.7], [0.2, 0.5], [0.55, 0.75], [0.9, 0.35], [0.6, 0.1], [-0.5, -0.6]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 8], [8, 5], [1, 9]] },
    { name: "libra", symbol: "♎", names: { ko: "천칭자리", en: "Libra", ja: "てんびん座", "zh-TW": "天秤座" },
      points: [[0.6, -0.1], [-0.15, 0.7], [-0.75, 0.1], [0.8, -0.75], [-0.5, -0.8], [-0.2, -0.95], [0.1, 0.2], [0.95, 0.6], [-0.95, 0.5], [0.3, -0.6]],
      lines: [[0, 1], [1, 2], [0, 3], [2, 4], [4, 5], [6, 1], [7, 1], [8, 2], [9, 3]] },
    { name: "scorpius", symbol: "♏", names: { ko: "전갈자리", en: "Scorpius", ja: "さそり座", "zh-TW": "天蠍座" },
      points: [[-0.2, 0.2], [0.6, 0.7], [0.75, 0.45], [0.55, 0.25], [-0.45, -0.1], [-0.6, -0.45], [-0.5, -0.8], [-0.1, -0.95], [0.3, -0.8], [0.5, -0.55]],
      lines: [[1, 2], [2, 3], [3, 0], [0, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]] },
    { name: "sagittarius", symbol: "♐", names: { ko: "궁수자리", en: "Sagittarius", ja: "いて座", "zh-TW": "射手座" },
      points: [[0, 0.75], [-0.45, 0.25], [0.45, 0.3], [-0.55, -0.5], [0.35, -0.55], [0.95, -0.1], [-0.95, -0.1], [-0.9, 0.4], [0.1, -0.95], [0.6, 0.9]],
      lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [2, 5], [4, 5], [1, 7], [7, 6], [6, 3], [8, 4], [9, 2]] },
    { name: "capricornus", symbol: "♑", names: { ko: "염소자리", en: "Capricornus", ja: "やぎ座", "zh-TW": "摩羯座" },
      points: [[-0.9, 0.6], [-0.6, 0.75], [0, 0.2], [0.6, 0.05], [0.95, -0.15], [0.5, -0.55], [0, -0.85], [-0.5, -0.55], [-0.85, 0], [-0.3, 0.45]],
      lines: [[0, 1], [1, 9], [9, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0]] },
    { name: "aquarius", symbol: "♒", names: { ko: "물병자리", en: "Aquarius", ja: "みずがめ座", "zh-TW": "水瓶座" },
      points: [[-0.2, 0.6], [0.3, 0.8], [0.6, 0.5], [0.85, 0.75], [-0.6, 0.3], [-0.9, -0.1], [0, 0.1], [0.3, -0.3], [0.1, -0.65], [0.5, -0.95]],
      lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [0, 6], [6, 7], [7, 8], [8, 9]] },
    { name: "pisces", symbol: "♓", names: { ko: "물고기자리", en: "Pisces", ja: "うお座", "zh-TW": "雙魚座" },
      points: [[0, -0.9], [-0.4, -0.5], [-0.8, -0.1], [-0.95, 0.4], [-0.6, 0.6], [-0.55, 0.15], [0.3, -0.4], [0.6, 0.1], [0.9, 0.6], [0.65, 0.9]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [0, 6], [6, 7], [7, 8], [8, 9]] },
];
export const SHAPES = ZODIAC;

// 방 slug → 어울리는 별자리. 모르는 방은 비어 있는 별자리를 순서대로 (지금 빈자리는 6번째 처녀자리 = 첫 사용자 제안 몫)
const BY_SLUG: Record<string, string> = {
    "to-my-twenties": "aries", // 시작
    "first-love": "pisces", // 사랑의 신화
    "to-mom-and-dad": "cancer", // 가정
    "to-my-ex": "libra", // 저울질하던 마음
    "to-me-who-endured": "capricornus", // 인내
    "to-me-in-ten-years": "aquarius", // 미래
    "to-me-this-year": "leo", // 올해의 주인공
    "to-someone-in-heaven": "scorpius", // 먼저 떠난 사람·아이 (죽음과 다시 태어남)
    "to-a-friend-i-lost-touch-with": "gemini", // 쌍둥이 같던 친구
    "to-my-child": "taurus", // 든든함 (2번째 자리를 채워 빈 별자리가 6번째 처녀자리로 가게)
    "to-you-beside-me": "sagittarius", // 같이 가는 길
};

export function zodiacIndexFor(slug: string): number | null {
    const name = BY_SLUG[slug];
    const i = name ? ZODIAC.findIndex((z) => z.name === name) : -1;
    return i >= 0 ? i : null;
}

// 방 목록 → 별자리 번호 배정 (정해진 방은 그 자리, 나머지는 빈 별자리부터). 방이 12개를 넘으면 뒤는 하늘에 못 올림
export function assignRooms(slugs: string[]): Map<string, number> {
    const out = new Map<string, number>();
    const used = new Set<number>();
    for (const s of slugs) {
        const i = zodiacIndexFor(s);
        if (i != null && !used.has(i)) {
            out.set(s, i);
            used.add(i);
        }
    }
    let next = 0;
    for (const s of slugs) {
        if (out.has(s)) continue;
        while (next < ZODIAC.length && used.has(next)) next++;
        if (next >= ZODIAC.length) break;
        out.set(s, next);
        used.add(next);
    }
    return out;
}

// 옛 호환
export function shapeFor(slug: string, index: number): Shape {
    const i = zodiacIndexFor(slug);
    return ZODIAC[i ?? index % ZODIAC.length];
}
