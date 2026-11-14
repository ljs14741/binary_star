import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomBySlug, listRooms } from "@/lib/rooms";
import { requireLang } from "@/lib/page";
import { t } from "@/lib/i18n";
import WriteForm from "@/components/WriteForm";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "write_title"), robots: { index: false } };
}

export default async function WritePage({ params }: P) {
    const lang = await requireLang(params);
    const { slug } = await params;
    const [room, rooms] = await Promise.all([getRoomBySlug(slug, lang), listRooms(lang)]);
    if (!room || room.status !== "open") notFound();
    return <WriteForm roomSlug={slug} roomTitle={room.title} rooms={rooms.filter((r) => r.status === "open").map((r) => ({ slug: r.slug, title: r.title }))} />;
}
