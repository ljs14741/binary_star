import { LOCALE, type Lang } from "./i18n/config";

export function countryName(code: string | null | undefined, lang: Lang): string | null {
    if (!code) return null;
    try {
        return new Intl.DisplayNames([LOCALE[lang]], { type: "region" }).of(code) || code;
    } catch {
        return code;
    }
}

export function flagEmoji(code: string | null | undefined): string {
    if (!code || code.length !== 2) return "🌏";
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function formatNumber(n: number, lang: Lang): string {
    return new Intl.NumberFormat(LOCALE[lang]).format(n);
}

export function formatDate(d: Date | string, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
    const date = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: "Asia/Seoul", ...(opts ?? { dateStyle: "medium" }) }).format(date);
}

// 이야기 첫 문장 (제목·OG 용)
export function excerpt(body: string, max = 60): string {
    const first = body.split(/\n/).find((l) => l.trim())?.trim() ?? "";
    const sentence = first.split(/(?<=[.!?。！？])\s/)[0] || first;
    return sentence.length > max ? sentence.slice(0, max - 1) + "…" : sentence;
}

export function daysLeft(until: Date): number {
    return Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86_400_000));
}

// "3일 전" 같은 상대 시간
export function relTime(iso: string, lang: Lang): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000; // 음수 = 과거
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
    if (abs < 60) return lang === "ko" ? "방금" : lang === "ja" ? "たった今" : lang === "zh-TW" ? "剛剛" : "just now";
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
    if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
    return rtf.format(Math.round(diff / (86400 * 365)), "year");
}
