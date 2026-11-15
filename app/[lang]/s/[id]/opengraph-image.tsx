import { ImageResponse } from "next/og";
import { getPublicStory } from "@/lib/stories";
import { isLang, type Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { siteName } from "@/lib/site";
import { loadOgFonts } from "@/lib/og-fonts";
import { countryName, formatNumber } from "@/lib/format";
import { hillBackground } from "@/lib/og-bg";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "story card";

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
    const { lang: l, id } = await params;
    const lang: Lang = isLang(l) ? l : "ko";
    const story = await getPublicStory(parseInt(id, 10), lang);
    const fonts = await loadOgFonts(lang);
    const fontFamily = fonts.map((f) => `"${f.name}"`).join(", ");
    const body = story ? story.body.replace(/\s+/g, " ").trim() : t(lang, "nf_title");
    const text = body.length > 90 ? body.slice(0, 88) + "…" : body;
    const fontSize = text.length > 60 ? 38 : text.length > 30 ? 46 : 56;
    const meta = story ? `${t(lang, "og_empathy", { n: formatNumber(story.empathyCount, lang) })}   ·   ${t(lang, "og_countries", { n: story.countryCount }).replace("🌏 ", "")}` : "";
    const where = story?.country ? `${countryName(story.country, lang)}` : "";

    const bg = hillBackground();
    // 배경은 실제 언덕 장면을 어둡게. 글자는 가운데 정렬로 모아 정사각형으로 잘려도 읽히게
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#0b1026", color: "#F3F1EA", fontFamily, position: "relative", padding: "56px 120px 48px" }}>
                {bg && <img src={bg} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} />}
                <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, background: "linear-gradient(180deg, rgba(7,11,29,0.82) 0%, rgba(7,11,29,0.72) 60%, rgba(7,11,29,0.35) 100%)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: "#FFD86B" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 20px #FFD86B" }} />
                    {story?.roomTitle ?? siteName(lang)}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", wordBreak: "keep-all", fontSize, lineHeight: 1.45, fontWeight: 700, letterSpacing: -1, textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>“{text}”</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 24, color: "#FFE9A6" }}>
                        {meta}
                        {where ? <span style={{ color: "#A8ADC4" }}>· {where}</span> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ fontSize: 26, padding: "10px 30px", borderRadius: 99, background: "#FFD86B", color: "#2a1f05", fontWeight: 700 }}>{t(lang, "share_title")}</div>
                        <div style={{ fontSize: 22, color: "#C3C8DD" }}>{siteName(lang)}</div>
                    </div>
                </div>
            </div>
        ),
        { ...size, fonts: fonts.length ? fonts : undefined }
    );
}
