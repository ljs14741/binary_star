import type { Metadata } from "next";
import Link from "next/link";
import { getFeaturedRoom, getFeaturedWinner } from "@/lib/rooms";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { formatDate, daysLeft } from "@/lib/format";
import { getVoterKey } from "@/lib/voter";
import StoryCard from "@/components/StoryCard";
import { FeaturedBanner } from "@/components/RoomList";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "featured_title"), alternates: alternates("/featured", lang) };
}

export default async function FeaturedPage({ params }: P) {
    const lang = await requireLang(params);
    const room = await getFeaturedRoom(lang);
    if (!room) {
        return <p className="px-6 py-16 text-center text-muted">{t(lang, "featured_none")}</p>;
    }
    const until = room.featuredUntil ? new Date(room.featuredUntil) : null;
    const voterKey = await getVoterKey();
    const winner = room.featuredClosed ? await getFeaturedWinner(room, lang, voterKey) : null;
    return (
        <div className="px-4 pb-8 pt-3">
            <FeaturedBanner room={room} lang={lang} />
            <div className="mt-6">
                {room.featuredClosed ? (
                    <>
                        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">
                            <span className="text-star">★</span> {t(lang, "featured_result_title")}
                        </h2>
                        {winner ? <StoryCard story={winner} compact /> : <p className="text-muted">{t(lang, "featured_no_entries")}</p>}
                    </>
                ) : (
                    <div className="text-center">
                        {until && (
                            <p className="text-sm text-muted">
                                {t(lang, "featured_until", { date: formatDate(until, lang, { dateStyle: "long", timeStyle: "short" }) })} · {t(lang, "featured_dday", { n: daysLeft(until) })}
                            </p>
                        )}
                        <Link href={`/${lang}/room/${room.slug}`} className="btn-star mt-5 inline-flex h-12 items-center rounded-full px-6 font-semibold">
                            {t(lang, "featured_open_room")}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
