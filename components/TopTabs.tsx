"use client";

import { useState } from "react";
import Link from "next/link";
import type { TopResult } from "@/lib/rooms";
import StoryCard from "./StoryCard";
import { useLang, useT } from "./I18nProvider";
import { countryName, flagEmoji } from "@/lib/format";
import { langPath } from "@/lib/client";

export default function TopTabs({ top, roomSlug }: { top: TopResult; roomSlug: string }) {
    const t = useT();
    const lang = useLang();
    const [tab, setTab] = useState<"all" | "age" | "country">("all");
    const tabs = [
        ["all", t("top_all")],
        ["age", t("top_age")],
        ["country", t("top_country")],
    ] as const;
    return (
        <div>
            <div className="mb-4 flex gap-1 rounded-full bg-card p-1">
                {tabs.map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-2 text-sm transition ${tab === k ? "btn-star font-semibold" : "text-muted"}`}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === "all" && (
                <div className="grid gap-3">
                    {top.all.length === 0 && <p className="py-10 text-center text-muted">{t("top_empty")}</p>}
                    {top.all.map((s, i) => (
                        <div key={s.id}>
                            <p className="mb-1 text-xs font-semibold text-star">{t("top_rank", { n: i + 1 })}</p>
                            <StoryCard story={s} compact />
                        </div>
                    ))}
                </div>
            )}
            {tab === "age" && (
                <div className="grid gap-4">
                    {top.byAge.length === 0 && <p className="py-10 text-center text-muted">{t("top_empty")}</p>}
                    {top.byAge.map((g) => (
                        <div key={g.key}>
                            <p className="mb-1 text-sm font-semibold text-ink">{t(`age_${g.key}` as "age_20s")}</p>
                            {g.story ? <StoryCard story={g.story} compact /> : <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-dim">{t("top_few", { n: g.count })}</p>}
                        </div>
                    ))}
                </div>
            )}
            {tab === "country" && (
                <div className="grid gap-4">
                    {top.byCountry.length === 0 && <p className="py-10 text-center text-muted">{t("top_empty")}</p>}
                    {top.byCountry.map((g) => (
                        <div key={g.key}>
                            <p className="mb-1 text-sm font-semibold text-ink">
                                {flagEmoji(g.key)} {countryName(g.key, lang)}
                            </p>
                            {g.story ? <StoryCard story={g.story} compact /> : <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-dim">{t("top_few", { n: g.count })}</p>}
                        </div>
                    ))}
                </div>
            )}
            <Link href={langPath(lang, `/room/${roomSlug}`)} className="mt-6 block text-center text-sm text-muted underline-offset-4 hover:underline">
                ← {t("read_stories")}
            </Link>
        </div>
    );
}
