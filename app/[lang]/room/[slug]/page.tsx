import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomBySlug } from "@/lib/rooms";
import { getFeed } from "@/lib/stories";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { siteName } from "@/lib/site";
import { getVoterKey } from "@/lib/voter";
import StorySwiper from "@/components/StorySwiper";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    const { slug } = await params;
    const room = await getRoomBySlug(slug, lang);
    if (!room) return {};
    return {
        title: room.title,
        description: `${room.description} · ${t(lang, "room_story_count", { n: room.storyCount })} · ${siteName(lang)}`,
        alternates: alternates(`/room/${slug}`, lang),
        openGraph: { title: t(lang, "meta_room_title", { room: room.title, site: siteName(lang) }), description: room.description },
    };
}

export default async function RoomPage({ params }: P) {
    const lang = await requireLang(params);
    const { slug } = await params;
    const room = await getRoomBySlug(slug, lang);
    if (!room) notFound();
    const voterKey = await getVoterKey();
    const feed = await getFeed({ roomSlug: slug, lang, voterKey, limit: 6 });
    return (
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
            <div className="shrink-0 px-4 pt-2">
                <h1 className="text-lg font-semibold text-ink">{room.title}</h1>
                <p className="text-xs text-muted">
                    {room.description} · {t(lang, "room_story_count", { n: room.storyCount })}
                </p>
            </div>
            <StorySwiper roomSlug={slug} roomTitle={room.title} initial={feed.stories} initialHasMore={feed.hasMore} />
        </div>
    );
}
