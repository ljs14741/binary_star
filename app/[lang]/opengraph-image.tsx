import { ImageResponse } from "next/og";
import { isLang, type Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import { loadOgFonts } from "@/lib/og-fonts";
import { hillBackground } from "@/lib/og-bg";

// 홈·방·소개 등 이야기가 아닌 페이지의 공유 썸네일 (이야기 페이지는 s/[id]/opengraph-image 가 따로 있음)
// 배경은 실제 언덕 장면. 글자는 가운데에 모아 정사각형으로 잘리는 미리보기(카톡 링크·아이폰 메시지)에서도 읽히게
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "night hill";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
    const { lang: l } = await params;
    const lang: Lang = isLang(l) ? l : "ko";
    const fonts = await loadOgFonts(lang);
    const fontFamily = fonts.map((f) => `"${f.name}"`).join(", ");
    const bg = hillBackground();
    // 태그라인은 쉼표에서 줄을 나눠 단어 중간이 끊기지 않게
    const lines = t(lang, "site_tagline").split(/(?<=[,，、])\s*/);
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b1026", color: "#F3F1EA", fontFamily, position: "relative" }}>
                {bg && <img src={bg} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} />}
                {/* 글자 뒤만 살짝 어둡게 */}
                <div style={{ position: "absolute", left: 0, right: 0, top: 150, height: 300, background: "radial-gradient(ellipse 520px 170px at 50% 50%, rgba(7,11,29,0.62), rgba(7,11,29,0))" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -60 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, color: "#FFD86B", fontWeight: 700 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 99, background: "#FFD86B", boxShadow: "0 0 24px #FFD86B" }} />
                        {siteName(lang)}
                    </div>
                    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", fontSize: 42, lineHeight: 1.35, fontWeight: 700, letterSpacing: -1, textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}>
                        {lines.map((ln, i) => (
                            <div key={i}>{ln}</div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, fontSize: 22, color: "#C3C8DD" }}>{getBaseUrl().replace(/^https?:\/\//, "")}</div>
                </div>
            </div>
        ),
        { ...size, fonts: fonts.length ? fonts : undefined }
    );
}
