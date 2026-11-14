import type { Metadata } from "next";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { PROPOSAL_THRESHOLD, siteName } from "@/lib/site";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "terms_title"), alternates: alternates("/terms", lang) };
}

export default async function Page({ params }: P) {
    const lang = await requireLang(params);
    const body = t(lang, "terms_body", { site: siteName(lang), threshold: PROPOSAL_THRESHOLD });
    return (
        <article className="px-5 pb-10 pt-4">
            <h1 className="mb-4 text-xl font-semibold text-ink">{t(lang, "terms_title")}</h1>
            {body.split("\n\n").map((p, i) => (
                <p key={i} className="mb-3 text-[15px] leading-relaxed text-muted">
                    {p}
                </p>
            ))}
        </article>
    );
}
