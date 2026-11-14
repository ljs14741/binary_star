import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomBySlug, getTop } from "@/lib/rooms";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { getVoterKey } from "@/lib/voter";
import TopTabs from "@/components/TopTabs";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    const { slug } = await params;
    const room = await getRoomBySlug(slug, lang);
    if (!room) return {};
    return { title: t(lang, "top_title", { room: room.title }), alternates: alternates(`/room/${slug}/top`, lang) };
}

export default async function TopPage({ params }: P) {
    const lang = await requireLang(params);
    const { slug } = await params;
    const room = await getRoomBySlug(slug, lang);
    if (!room) notFound();
    const voterKey = await getVoterKey();
    const top = await getTop(room.id, lang, voterKey);
    return (
        <div className="px-4 pb-8 pt-2">
            <h1 className="mb-3 text-lg font-semibold text-ink">{t(lang, "top_title", { room: room.title })}</h1>
            <TopTabs top={top} roomSlug={slug} />
        </div>
    );
}
