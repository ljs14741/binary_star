"use client";
// 후원해 주신 분들 (이름 가운데 가림). 아직 없으면 아무것도 안 그림
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useLang, useT } from "./I18nProvider";
import { api } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import type { PublicDonation } from "@/lib/donations-shared";

const COLLAPSED = 3;

export default function DonorWall() {
    const t = useT();
    const lang = useLang();
    const [data, setData] = useState<{ count: number; items: PublicDonation[] } | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        api<{ count: number; items: PublicDonation[] }>("/api/donations").then((r) => r.ok && setData({ count: r.count, items: r.items }));
    }, []);
    if (!data || data.count === 0) return null;
    const shown = open ? data.items : data.items.slice(0, COLLAPSED);
    return (
        <div className="mt-4 rounded-2xl border border-star/20 bg-star/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-star-soft">
                <Heart size={12} className="fill-current" /> {t("donate_wall_title", { n: data.count })}
            </p>
            <ul className={`space-y-1.5 ${open ? "max-h-52 overflow-y-auto pr-1" : ""}`}>
                {shown.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="font-semibold text-ink">{t("donate_sir", { name: d.name })}</span>
                        <span className="flex items-center gap-2 tabular-nums text-muted">
                            <span className="text-ink/90">{t("donate_amount", { n: formatNumber(d.amount, lang) })}</span>
                            <span className="text-dim">{d.date.slice(2).replace(/-/g, ".")}</span>
                        </span>
                    </li>
                ))}
            </ul>
            {data.items.length > COLLAPSED && (
                <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-[11px] font-semibold text-dim hover:text-star-soft">
                    {open ? t("donate_wall_less") : t("donate_wall_more", { n: data.items.length })}
                </button>
            )}
        </div>
    );
}
