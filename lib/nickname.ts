// 처음 글 쓸 때 자동으로 채워 주는 별명 (형용사 + 밤하늘·동물). 화면 언어별, NICKNAME_MAX_LEN 안에 맞춤
import type { Lang } from "./i18n/config";
import { NICKNAME_MAX_LEN } from "./site";
import { hasBannedWord, hasUrl, maskPii } from "./moderation";

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

// ---------- 별명 검사 (서버·브라우저 같은 규칙) ----------
// 글 본문보다 엄격: 별명은 모든 글에 따라다니니 성적·비하·사칭 낱말은 문맥 없이 막음
const NICK_BANNED: RegExp[] = [
    /섹스|섹시|야동|자지|보지|ㅈㅈ|ㅂㅈ|성기|변태|강간|애미|애비|느금|꼴통|찐따|장애인|정신병|일베|메갈|히틀러|나치|마약|대마|운영자|관리자|관리인|별말씀|공식/u,
    /\b(sex|sexy|porn|dick|pussy|penis|vagina|boobs?|nazi|hitler|admin|staff|official|moderator)\b|sex|porn/i,
    /セックス|エロ|ちんこ|まんこ|変態|運営|管理人|公式/u,
    /做愛|色情|雞雞|鸡鸡|變態|变态|管理員|管理员|官方/u,
];

export type NicknameCheck = { ok: true; value: string | null } | { ok: false };

export function checkNickname(raw: string | null | undefined): NicknameCheck {
    const full = (raw ?? "").replace(/\s+/g, " ").trim();
    const v = full.slice(0, NICKNAME_MAX_LEN);
    if (!v) return { ok: true, value: null };
    const squeezed = v.replace(/[\s.\-_*,!?~`'"·]/gu, "");
    // 글자 없이 기호·숫자만, 전화번호·이메일·주소, 금칙어
    if (!/[\p{L}]/u.test(v)) return { ok: false };
    if (hasBannedWord(v) || hasUrl(full) || maskPii(full).masked || /[@#<>]/.test(v) || /\d{4,}/.test(full)) return { ok: false };
    if (NICK_BANNED.some((re) => re.test(v) || re.test(squeezed))) return { ok: false };
    return { ok: true, value: v };
}
