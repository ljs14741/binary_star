// 처음 글 쓸 때 자동으로 채워 주는 별명 (형용사 + 밤하늘·동물). 화면 언어별, NICKNAME_MAX_LEN 안에 맞춤
import type { Lang } from "./i18n/config";
import { NICKNAME_MAX_LEN } from "./site";

const WORDS: Record<Lang, { adj: string[]; noun: string[]; sep: string }> = {
    ko: {
        adj: ["졸린", "조용한", "따뜻한", "수줍은", "느긋한", "반짝이는", "포근한", "용감한", "엉뚱한", "다정한", "새벽의", "한밤의", "작은", "설레는", "말랑한", "꿈꾸는"],
        noun: ["고래", "고양이", "여우", "부엉이", "토끼", "펭귄", "별똥별", "달팽이", "다람쥐", "해파리", "곰", "수달", "반딧불", "등대", "구름", "사슴"],
        sep: " ",
    },
    en: {
        adj: ["Sleepy", "Quiet", "Warm", "Shy", "Calm", "Tiny", "Brave", "Kind", "Soft", "Dreamy", "Mellow", "Starry"],
        noun: ["Owl", "Fox", "Cat", "Seal", "Moth", "Whale", "Otter", "Deer", "Bear", "Moon", "Cloud", "Comet", "Wren"],
        sep: " ",
    },
    ja: {
        adj: ["ねむい", "しずかな", "やさしい", "ちいさな", "ふわふわ", "よふかしの", "きらきら", "のんびり"],
        noun: ["クジラ", "ネコ", "キツネ", "フクロウ", "ウサギ", "ペンギン", "ホタル", "クマ", "ラッコ", "シカ", "ほうき星"],
        sep: "",
    },
    "zh-TW": {
        adj: ["想睡的", "安靜的", "溫暖的", "害羞的", "閃亮的", "小小的", "勇敢的", "熬夜的", "慢慢的"],
        noun: ["鯨魚", "貓咪", "狐狸", "貓頭鷹", "兔子", "企鵝", "螢火蟲", "小熊", "水獺", "小鹿", "流星"],
        sep: "",
    },
};

const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

export function randomNickname(lang: Lang, rand: () => number = Math.random, avoid?: string): string {
    const w = WORDS[lang] ?? WORDS.ko;
    for (let i = 0; i < 50; i++) {
        const n = `${pick(w.adj, rand)}${w.sep}${pick(w.noun, rand)}`;
        if (n.length <= NICKNAME_MAX_LEN && n !== avoid) return n;
    }
    return pick(w.noun, rand);
}

// 모든 조합 (테스트용)
export function allNicknames(lang: Lang): string[] {
    const w = WORDS[lang];
    return w.adj.flatMap((a) => w.noun.map((n) => `${a}${w.sep}${n}`)).filter((n) => n.length <= NICKNAME_MAX_LEN);
}
