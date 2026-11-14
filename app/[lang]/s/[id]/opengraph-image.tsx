import { ImageResponse } from "next/og";
import { getPublicStory } from "@/lib/stories";
import { isLang, type Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { siteName } from "@/lib/site";
import { loadOgFonts } from "@/lib/og-fonts";
import { countryName, formatNumber } from "@/lib/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "story card";

const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 173) % 1200, y: (i * 97) % 630, r: 1 + (i % 3), o: 0.3 + ((i * 7) % 10) / 14 }));

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
    const { lang: l, id } = await params;
    const lang: Lang = isLang(l) ? l : "ko";
    const story = await getPublicStory(parseInt(id, 10), lang);
    const fonts = await loadOgFonts(lang);
    const fontFamily = fonts.map((f) => `"${f.name}"`).join(", ");
    const body = story ? story.body.replace(/\s+/g, " ").trim() : t(lang, "nf_title");
    const text = body.length > 120 ? body.slice(0, 118) + "…" : body;
    const fontSize = text.length > 80 ? 40 : text.length > 40 ? 48 : 58;
    const meta = story ? `${t(lang, "og_empathy", { n: formatNumber(story.empathyCount, lang) })}   ·   ${t(lang, "og_countries", { n: story.countryCount }).replace("🌏 ", "")}` : "";
    const where = story?.country ? `${countryName(story.country, lang)}${story.city ? ` · ${story.city}` : ""}` : "";

    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg, #1a2352 0%, #0e1430 45%, #070b1d 100%)", color: "#F3F1EA", fontFamily, position: "relative", padding: 72 }}>
                {STARS.map((s, i) => (
                    <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: 99, background: `rgba(255,236,190,${s.o})` }} />
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#FFD86B" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 24px #FFD86B" }} />
                    {story?.roomTitle ?? siteName(lang)}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", fontSize, lineHeight: 1.45, fontWeight: 700, letterSpacing: -1, paddingRight: 40 }}>{text}</div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 30, color: "#FFE9A6" }}>{meta}</div>
                        <div style={{ fontSize: 22, color: "#A8ADC4" }}>{where}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ fontSize: 26, padding: "12px 28px", borderRadius: 99, background: "#FFD86B", color: "#2a1f05", fontWeight: 700 }}>{t(lang, "share_title")}</div>
                        <div style={{ fontSize: 22, color: "#6B7190" }}>{siteName(lang)}</div>
                    </div>
                </div>
            </div>
        ),
        { ...size, fonts: fonts.length ? fonts : undefined }
    );
}
