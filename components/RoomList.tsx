import Link from "next/link";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import type { RoomView } from "@/lib/rooms";
import type { Lang } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { formatNumber, formatDate, daysLeft } from "@/lib/format";

export function FeaturedBanner({ room, lang }: { room: RoomView; lang: Lang }) {
    const until = room.featuredUntil ? new Date(room.featuredUntil) : null;
    const closed = room.featuredClosed;
    return (
        <Link
            href={closed ? `/${lang}/featured` : `/${lang}/room/${room.slug}`}
            className="relative block overflow-hidden rounded-3xl border border-star/30 p-5"
            style={{ background: "linear-gradient(135deg, rgba(255,216,107,0.16), rgba(255,216,107,0.04) 60%, rgba(255,155,179,0.08))" }}
        >
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-star">
                <Sparkles size={12} /> {t(lang, "featured_label")}
                {until && !closed && <span className="ml-auto rounded-full bg-star/20 px-2 py-0.5 text-star-soft">{t(lang, "featured_dday", { n: daysLeft(until) })}</span>}
            </div>
            <h2 className="text-xl font-semibold text-ink">{room.title}</h2>
            <p className="mt-1 text-xs text-muted">
                {closed ? t(lang, "featured_closed") : until ? t(lang, "featured_closes", { date: formatDate(until, lang, { month: "long", day: "numeric" }) }) : room.description}
            </p>
            <p className="mt-2 text-xs text-dim">{t(lang, "room_story_count", { n: formatNumber(room.storyCount, lang) })}</p>
        </Link>
    );
}

export default function RoomList({ rooms, lang }: { rooms: RoomView[]; lang: Lang }) {
    return (
        <ul className="grid gap-2.5">
            {rooms.map((r) => (
                <li key={r.id}>
                    <Link href={`/${lang}/room/${r.slug}`} className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition hover:bg-card-strong">
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[15px] font-semibold text-ink">{r.title}</h3>
                            {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-dim">{t(lang, "room_story_count", { n: formatNumber(r.storyCount, lang) })}</span>
                        <ChevronRight size={16} className="shrink-0 text-dim" />
                    </Link>
                </li>
            ))}
            <li>
                <Link href={`/${lang}/propose`} className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line px-4 py-3.5 text-sm text-muted hover:text-ink">
                    <Plus size={15} /> {t(lang, "propose_button")}
                </Link>
            </li>
        </ul>
    );
}
