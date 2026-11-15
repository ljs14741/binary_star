import type { Metadata } from "next";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import ProposalBoard from "@/components/ProposalBoard";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "propose_title"), alternates: alternates("/propose", lang) };
}

export default async function ProposePage({ params }: P) {
    const lang = await requireLang(params);
    return (
        <div className="px-4 pb-8 pt-3">
            <h1 className="text-xl font-semibold text-ink">{t(lang, "propose_title")}</h1>
            <p className="mb-4 text-sm text-muted">{t(lang, "propose_sub")}</p>
            <ProposalBoard />
        </div>
    );
}
