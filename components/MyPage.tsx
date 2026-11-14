"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { Link2 } from "lucide-react";
import type { MineResult } from "@/lib/stories";
import { useLang, useT } from "./I18nProvider";
import { useToast } from "./Toast";
import { useDialog } from "./Dialog";
import { api, getLastTotal, getOwnerToken, langPath, setLastTotal, setOwnerToken, siteOrigin } from "@/lib/client";
import StoryCard from "./StoryCard";
import CrisisNotice from "./CrisisNotice";
import { countryName, flagEmoji, formatNumber } from "@/lib/format";

const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <div className="mx-auto aspect-square w-full max-w-[360px] animate-pulse rounded-full bg-card" /> });

export default function MyPage({ token }: { token: string }) {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const { showCopy } = useDialog();
    const [data, setData] = useState<MineResult | null>(null);
    const [delta, setDelta] = useState<number | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        api<MineResult>(`/api/me/${token}?lang=${lang}`).then((r) => {
            if (!r.ok) return setFailed(true);
            setData(r);
            // 이 링크로 들어왔으면 이 브라우저도 주인으로 기억 (다른 폰에서 열었을 때)
            if (r.stories.length > 0 && !getOwnerToken()) setOwnerToken(token);
            const last = getLastTotal(token);
            setDelta(last === null ? null : Math.max(0, r.total - last));
            setLastTotal(token, r.total);
        });
    }, [token, lang]);

    if (failed) return <p className="px-6 py-16 text-center text-muted">{t("me_not_found")}</p>;
    if (!data) return <p className="px-6 py-16 text-center text-muted">{t("loading")}</p>;
    if (data.stories.length === 0) return <p className="px-6 py-16 text-center text-muted">{t("me_not_found")}</p>;

    const meUrl = `${siteOrigin()}${langPath(lang, `/me/${token}`)}`;
    const hasCrisis = data.stories.some((s) => s.moderationNote === "crisis");
    // 공감이 온 곳 한 줄 ("서울 3 · 부산 1 · Tokyo 1")
    const placeList = data.lights.slice(0, 5).map((l) => `${l.city || (l.country ? countryName(l.country, lang) : t("country_unknown"))} ${formatNumber(l.count, lang)}`).join(" · ");
    const onlyCountry = data.countryCount === 1 ? data.lights.find((l) => l.country)?.country ?? null : null;

    return (
        <div className="px-4 pb-8 pt-3">
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <h1 className="text-sm text-muted">{t("me_title")}</h1>
                {delta !== null && delta > 0 ? (
                    <p className="mt-1 text-3xl font-semibold text-star">{t("me_new", { n: formatNumber(delta, lang) })}</p>
                ) : (
                    <p className="mt-1 text-3xl font-semibold text-ink">{t("me_total", { n: formatNumber(data.total, lang) })}</p>
                )}
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {data.total > 0 ? t("me_intro", { s: data.stories.length, n: formatNumber(data.total, lang) }) : t("me_intro_zero")}
                </p>
                {placeList && <p className="mt-1 text-xs text-dim">{t("me_cities_line", { list: placeList })}</p>}
            </motion.section>

            {/* 공감이 온 도시 불빛. 한 나라에서만 왔으면 그 나라를 크게 보여 줌 */}
            {data.lights.length > 0 && (
                <div className="mt-4">
                    <Globe lights={data.lights} />
                    <p className="mt-1 text-center text-[11px] text-dim">{onlyCountry ? t("me_only_country", { country: countryName(onlyCountry, lang) ?? onlyCountry }) : t("me_globe_hint")}</p>
                </div>
            )}

            {data.lights.length > 0 && (
                <section className="mt-5">
                    <h2 className="mb-2 text-sm font-semibold text-muted">{t("me_cities_title")}</h2>
                    <ul className="grid grid-cols-2 gap-1.5 text-sm">
                        {data.lights.slice(0, 12).map((l, i) => (
                            <li key={i} className={`glass flex items-center justify-between rounded-xl px-3 py-2 ${l.mine ? "border-rose/40" : ""}`}>
                                <span className="truncate">
                                    {flagEmoji(l.country)} {l.city || countryName(l.country, lang)}
                                    {l.mine && <span className="ml-1 text-[10px] text-rose">{t("me_mine_light")}</span>}
                                </span>
                                <span className="ml-2 tabular-nums text-star-soft">{formatNumber(l.count, lang)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {hasCrisis && (
                <div className="mt-5">
                    <CrisisNotice />
                </div>
            )}

            <p className="mt-6 mb-2 text-[11px] text-dim">{t("me_edit_window")}</p>
            <section className="grid gap-3">
                {data.stories.map((s) => (
                    <StoryCard
                        key={s.id}
                        story={s}
                        ownerView
                        showRoom
                        onOwnerChange={(next) =>
                            setData((d) => (d ? { ...d, stories: next ? d.stories.map((x) => (x.id === s.id ? next : x)) : d.stories.filter((x) => x.id !== s.id) } : d))
                        }
                    />
                ))}
            </section>

            <button
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(meUrl);
                        toast(t("copied"));
                    } catch {
                        showCopy({ title: t("after_save_link"), value: meUrl });
                    }
                }}
                className="glass mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm text-ink"
            >
                <Link2 size={15} /> {t("after_save_link")}
            </button>
            <p className="mt-2 text-center text-[11px] text-dim">{t("me_link_hint")}</p>
            <Link href={langPath(lang)} className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:underline">
                {t("after_more")}
            </Link>
        </div>
    );
}
