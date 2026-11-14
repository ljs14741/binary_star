"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PenLine, Trophy, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import type { StoryView } from "@/lib/stories";
import StoryCard from "./StoryCard";
import { useLang, useT } from "./I18nProvider";
import { addSeen, api, getSeen, langPath } from "@/lib/client";

type Props = { roomSlug?: string; roomTitle?: string; firstId?: number; initial: StoryView[]; initialHasMore: boolean };

export default function StorySwiper({ roomSlug, roomTitle, firstId, initial, initialHasMore }: Props) {
    const t = useT();
    const lang = useLang();
    const [stories, setStories] = useState<StoryView[]>(initial);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loading, setLoading] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const seenBuffer = useRef<Set<number>>(new Set());

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        const exclude = stories.map((s) => s.id).join(",");
        const seen = getSeen().slice(-200).join(",");
        const q = new URLSearchParams({ lang, exclude, seen, limit: "8" });
        if (roomSlug) q.set("room", roomSlug);
        const r = await api<{ stories: StoryView[]; hasMore: boolean }>(`/api/stories?${q}`);
        if (r.ok) {
            setStories((cur) => {
                const ids = new Set(cur.map((s) => s.id));
                return [...cur, ...r.stories.filter((s) => !ids.has(s.id))];
            });
            setHasMore(r.hasMore && r.stories.length > 0);
        }
        setLoading(false);
    }, [loading, hasMore, stories, lang, roomSlug]);

    // 화면에 60% 이상 보인 카드는 '본 것'으로 기억. 끝에서 두 번째 카드가 보이면 더 불러옴
    useEffect(() => {
        const root = container.current;
        if (!root) return;
        const items = root.querySelectorAll<HTMLElement>("[data-story-id]");
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;
                    const id = Number(e.target.getAttribute("data-story-id"));
                    const idx = Number(e.target.getAttribute("data-index"));
                    if (id && !seenBuffer.current.has(id)) {
                        seenBuffer.current.add(id);
                        addSeen([id]);
                    }
                    if (idx >= stories.length - 2) loadMore();
                }
            },
            { root, threshold: 0.6 }
        );
        items.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [stories, loadMore]);

    const scrollToIndex = (i: number) => {
        const el = container.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const hide = (id: number) => setStories((cur) => cur.filter((s) => s.id !== id));

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={container} className="snap-feed min-h-0 flex-1 overflow-y-auto pb-28">
                {stories.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted">
                        <p>{t("feed_empty")}</p>
                    </div>
                )}
                {stories.map((s, i) => (
                    <section key={s.id} data-story-id={s.id} data-index={i} className={`snap-item flex min-h-full flex-col justify-center px-4 pt-4 ${roomSlug ? "pb-24" : "pb-6"}`}>
                        <StoryCard story={s} sharedFirst={i === 0 && firstId === s.id} onNext={() => scrollToIndex(i + 1)} onHidden={hide} showRoom={!roomSlug} />
                        {i === 0 && stories.length > 1 && (
                            <motion.p
                                className="mt-3 flex items-center justify-center gap-1 text-xs text-muted"
                                animate={{ y: [0, -5, 0], opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <ChevronUp size={14} /> {t("swipe_hint")}
                            </motion.p>
                        )}
                    </section>
                ))}
                {stories.length > 0 && (
                    <section data-index={stories.length} className="snap-item flex min-h-full flex-col items-center justify-center px-6 text-center">
                        {hasMore || loading ? (
                            <p className="text-muted">{t("loading")}</p>
                        ) : (
                            <>
                                <p className="mb-5 text-muted">{t("feed_end")}</p>
                                {roomSlug && (
                                    <Link href={langPath(lang, `/room/${roomSlug}/write`)} className="btn-star flex h-12 items-center gap-2 rounded-full px-6 font-semibold">
                                        <PenLine size={16} /> {t("room_write_cta")}
                                    </Link>
                                )}
                            </>
                        )}
                    </section>
                )}
            </div>

            {roomSlug && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-center justify-between gap-2 px-4 pb-5 pt-10" style={{ background: "linear-gradient(to top, rgba(7,11,29,0.95), rgba(7,11,29,0))" }}>
                    <Link href={langPath(lang, `/room/${roomSlug}/top`)} className="glass pointer-events-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-sm text-ink">
                        <Trophy size={15} className="text-star" /> {t("room_top")}
                    </Link>
                    <Link href={langPath(lang, `/room/${roomSlug}/write`)} className="btn-star pointer-events-auto flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
                        <PenLine size={15} /> {t("write_story")}
                    </Link>
                </div>
            )}
            {roomTitle && <span className="sr-only">{roomTitle}</span>}
        </div>
    );
}
