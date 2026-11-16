import type { Metadata } from "next";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { PROPOSAL_THRESHOLD, siteName } from "@/lib/site";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "privacy_title"), alternates: alternates("/privacy", lang) };
}

export default async function Page({ params }: P) {
    const lang = await requireLang(params);
    const body = t(lang, "privacy_body", { site: siteName(lang), threshold: PROPOSAL_THRESHOLD });
    return (
        <article className="px-5 pb-10 pt-4">
            <h1 className="mb-4 text-xl font-semibold text-ink">{t(lang, "privacy_title")}</h1>
            {body.split("\n\n").map((p, i) => (
                <p key={i} className="mb-3 text-[15px] leading-relaxed text-muted">
                    {p}
                </p>
            ))}
            {/* DB-IP Lite 는 CC BY 4.0 이라 출처 표시가 필요함 (푸터에서 여기로 옮김) */}
            <p className="mt-6 text-[12px] text-dim">
                <a href="https://db-ip.com" target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-ink">
                    IP Geolocation by DB-IP
                </a>{" "}
                (CC BY 4.0)
            </p>
        </article>
    );
}
