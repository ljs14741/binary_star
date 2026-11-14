import { ImageResponse } from "next/og";
import { getPublicStory } from "@/lib/stories";
import { isLang, type Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import { loadOgFonts } from "@/lib/og-fonts";
import { formatNumber } from "@/lib/format";

// 인스타 스토리용 세로 카드 (1080x1920). 공유창의 "인스타그램" 이 이 이미지를 저장하거나 공유함
export const runtime = "nodejs";
const W = 1080, H = 1920;
const STARS = Array.from({ length: 110 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, r: 1.5 + (i % 3), o: 0.3 + ((i * 7) % 10) / 14 }));

export async function GET(_req: Request, ctx: { params: Promise<{ lang: string; id: string }> }) {
    const { lang: l, id } = await ctx.params;
    const lang: Lang = isLang(l) ? l : "ko";
    const story = await getPublicStory(parseInt(id, 10), lang);
    const fonts = await loadOgFonts(lang);
    const fontFamily = fonts.map((f) => `"${f.name}"`).join(", ");
    const body = story ? story.body.replace(/\s+/g, " ").trim() : t(lang, "nf_title");
    const text = body.length > 220 ? body.slice(0, 218) + "…" : body;
    const fontSize = text.length > 150 ? 46 : text.length > 80 ? 54 : 66;
    const url = `${getBaseUrl().replace(/^https?:\/\//, "")}/${lang}/s/${id}`;
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(170deg, #1a2352 0%, #0e1430 40%, #070b1d 100%)", color: "#F3F1EA", fontFamily, position: "relative", padding: "180px 88px 160px" }}>
                {STARS.map((s, i) => (
                    <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: 99, background: `rgba(255,236,190,${s.o})` }} />
                ))}
                {/* 달 */}
                <div style={{ position: "absolute", right: 110, top: 150, width: 120, height: 120, borderRadius: 99, background: "#fff4d6", boxShadow: "0 0 120px 40px rgba(255,236,190,0.35)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, color: "#FFD86B" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 30px #FFD86B" }} />
                    {story?.roomTitle ?? siteName(lang)}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", fontSize, lineHeight: 1.5, fontWeight: 700, letterSpacing: -1 }}>
                    <div style={{ display: "flex", padding: "56px 48px", borderRadius: 40, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>{`“${text}”`}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {story && <div style={{ fontSize: 40, color: "#FFE9A6" }}>{t(lang, "og_empathy", { n: formatNumber(story.empathyCount, lang) })}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <div style={{ fontSize: 34, padding: "16px 36px", borderRadius: 99, background: "#FFD86B", color: "#2a1f05", fontWeight: 700 }}>{t(lang, "share_title")}</div>
                        <div style={{ fontSize: 30, color: "#A8ADC4" }}>{url}</div>
                    </div>
                    <div style={{ fontSize: 28, color: "#6B7190" }}>{siteName(lang)}</div>
                </div>
                {/* 언덕 실루엣 */}
                <div style={{ position: "absolute", left: -200, right: -200, bottom: -260, height: 420, borderRadius: "50%", background: "#0a0f2a" }} />
            </div>
        ),
        { width: W, height: H, fonts: fonts.length ? fonts : undefined }
    );
}
