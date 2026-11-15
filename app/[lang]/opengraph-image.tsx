import { ImageResponse } from "next/og";
import { isLang, type Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import { loadOgFonts } from "@/lib/og-fonts";

// 홈·방·소개 등 이야기가 아닌 페이지의 공유 썸네일 (이야기 페이지는 s/[id]/opengraph-image 가 따로 있음)
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "night sky";

const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 173) % 1200, y: (i * 97) % 630, r: 1 + (i % 3), o: 0.3 + ((i * 7) % 10) / 14 }));
// 작은 별자리 하나 (양자리 단순형)
const SHAPE: [number, number][] = [[860, 150], [930, 200], [990, 180], [1050, 230], [1090, 300]];

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
    const { lang: l } = await params;
    const lang: Lang = isLang(l) ? l : "ko";
    const fonts = await loadOgFonts(lang);
    const fontFamily = fonts.map((f) => `"${f.name}"`).join(", ");
    // 태그라인은 쉼표에서 줄을 나눠 단어 중간이 끊기지 않게
    const lines = t(lang, "site_tagline").split(/(?<=[,，、])\s*/);
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "linear-gradient(160deg, #1a2352 0%, #0e1430 45%, #070b1d 100%)", color: "#F3F1EA", fontFamily, position: "relative", padding: 72 }}>
                {STARS.map((s, i) => (
                    <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: 99, background: `rgba(255,236,190,${s.o})` }} />
                ))}
                {SHAPE.map(([x, y], i) => (
                    <div key={`c${i}`} style={{ position: "absolute", left: x - 6, top: y - 6, width: 12, height: 12, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 18px #FFD86B" }} />
                ))}
                <div style={{ position: "absolute", left: 120, top: 110, width: 90, height: 90, borderRadius: 99, background: "#FFF4D6", boxShadow: "0 0 80px 30px rgba(255,236,196,0.35)" }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "linear-gradient(180deg, rgba(7,11,29,0) 0%, #0b1026 100%)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, color: "#FFD86B", fontWeight: 700 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 24px #FFD86B" }} />
                    {siteName(lang)}
                </div>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", fontSize: 52, lineHeight: 1.35, fontWeight: 700, letterSpacing: -1, maxWidth: 1056 }}>
                    {lines.map((ln, i) => (
                        <div key={i}>{ln}</div>
                    ))}
                </div>
                <div style={{ marginTop: 22, fontSize: 26, color: "#A8ADC4" }}>{getBaseUrl().replace(/^https?:\/\//, "")}</div>
            </div>
        ),
        { ...size, fonts: fonts.length ? fonts : undefined }
    );
}
