// 페이지 공통: 언어 파라미터 검증, hreflang, 서버에서 voterKey
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLang, LANGS, type Lang } from "./i18n/config";
import { getBaseUrl } from "./site";

export async function requireLang(params: Promise<{ lang: string }>): Promise<Lang> {
    const { lang } = await params;
    if (!isLang(lang)) notFound();
    return lang;
}

// 언어별 주소 + hreflang + canonical
export function alternates(path: string, lang: Lang): NonNullable<Metadata["alternates"]> {
    const base = getBaseUrl();
    const languages: Record<string, string> = {};
    for (const l of LANGS) languages[l === "zh-TW" ? "zh-Hant" : l] = `${base}/${l}${path}`;
    languages["x-default"] = `${base}/ko${path}`;
    return { canonical: `${base}/${lang}${path}`, languages };
}
