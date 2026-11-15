// 지원 언어. 주소는 /ko /en /ja /zh-TW
export const LANGS = ["ko", "en", "ja", "zh-TW"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ko";

export function isLang(v: string | undefined | null): v is Lang {
    return !!v && (LANGS as readonly string[]).includes(v);
}

// Intl 용 로케일
export const LOCALE: Record<Lang, string> = {
    ko: "ko-KR",
    en: "en-US",
    ja: "ja-JP",
    "zh-TW": "zh-Hant-TW",
};

// html lang 속성
export const HTML_LANG: Record<Lang, string> = {
    ko: "ko",
    en: "en",
    ja: "ja",
    "zh-TW": "zh-Hant-TW",
};

// 언어 스스로를 부르는 이름 (언어 전환 메뉴)
export const LANG_LABEL: Record<Lang, string> = {
    ko: "한국어",
    en: "English",
    ja: "日本語",
    "zh-TW": "繁體中文",
};

export const LANG_FLAG: Record<Lang, string> = {
    ko: "🇰🇷",
    en: "🇺🇸",
    ja: "🇯🇵",
    "zh-TW": "🇹🇼",
};

// Accept-Language 헤더에서 지원 언어 고름
export function pickLang(acceptLanguage: string | null | undefined): Lang {
    if (!acceptLanguage) return DEFAULT_LANG;
    const parts = acceptLanguage
        .split(",")
        .map((p, i) => {
            const [tag, q] = p.trim().split(";q=");
            return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 - i * 0.001 };
        })
        .sort((a, b) => b.q - a.q);
    for (const { tag } of parts) {
        if (tag.startsWith("ko")) return "ko";
        if (tag.startsWith("ja")) return "ja";
        if (tag.startsWith("zh")) {
            // 간체(zh-CN, zh-Hans)도 일단 번체 화면으로
            return "zh-TW";
        }
        if (tag.startsWith("en")) return "en";
    }
    return DEFAULT_LANG;
}

// 글자 종류로 언어 추정 (작성 시 lang 저장용)
export function detectLangByScript(text: string, fallback: Lang): Lang {
    const hangul = (text.match(/[가-힯ᄀ-ᇿ㄰-㆏]/g) || []).length;
    const kana = (text.match(/[぀-ゟ゠-ヿ]/g) || []).length;
    const han = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const max = Math.max(hangul, kana, han, latin);
    if (max === 0) return fallback;
    if (hangul === max) return "ko";
    if (kana === max || (kana > 0 && han > 0 && kana * 4 > han)) return "ja";
    if (han === max) return "zh-TW";
    // 로마자만 있을 땐 꽤 길어야 영어로 봄. "c", "lol" 같은 짧은 글은 화면 언어 그대로 (번역 꺼진 상태에선 언어가 다르면 안 보이므로)
    return latin >= 8 ? "en" : fallback;
}
