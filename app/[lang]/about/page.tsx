import type { Metadata } from "next";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { PROPOSAL_THRESHOLD, siteName } from "@/lib/site";
import { aiEnabled } from "@/lib/ai";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "about_title"), alternates: alternates("/about", lang) };
}

export default async function Page({ params }: P) {
    const lang = await requireLang(params);
    // AI 키가 없으면 "자동 번역" 문장을 뺀 소개문
    const body = t(lang, aiEnabled() ? "about_body" : "about_body_local", { site: siteName(lang), threshold: PROPOSAL_THRESHOLD });
    return (
        <article className="px-5 pb-10 pt-4">
            <h1 className="mb-4 text-xl font-semibold text-ink">{t(lang, "about_title")}</h1>
            {body.split("\n\n").map((p, i) => (
                <p key={i} className="mb-3 text-[15px] leading-relaxed text-muted">
                    {p}
                </p>
            ))}
        </article>
    );
}
