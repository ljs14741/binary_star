"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import type { ProposalView } from "@/lib/proposals";
import { PROPOSAL_MAX_LEN } from "@/lib/site";
import { useLang, useT } from "./I18nProvider";
import { useToast } from "./Toast";
import { api, langPath } from "@/lib/client";

export default function ProposalBoard() {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const [list, setList] = useState<ProposalView[]>([]);
    const [title, setTitle] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        api<{ proposals: ProposalView[] }>("/api/proposals").then((r) => {
            if (!alive || !r.ok) return;
            setList(r.proposals);
        });
        return () => {
            alive = false;
        };
    }, []);

    const submit = async () => {
        if (busy || !title.trim()) return;
        setBusy(true);
        const r = await api<{ proposal: ProposalView }>("/api/proposals", { method: "POST", json: { title, lang } });
        setBusy(false);
        if (r.ok) {
            setTitle("");
            setList((l) => [r.proposal, ...l]);
        } else toast(r.error === "limit" ? t("propose_err_limit") : r.error === "dup" ? t("propose_err_dup") : r.error === "banned" ? t("write_err_banned") : t("error_generic"));
    };

    const toggle = async (p: ProposalView) => {
        const r = await api<{ empathized: boolean; count: number; promotedSlug: string | null }>(`/api/proposals/${p.id}/empathy`, { method: "POST" });
        if (!r.ok) return toast(t("error_generic"));
        setList((l) => l.map((x) => (x.id === p.id ? { ...x, empathized: r.empathized, empathyCount: r.count, ...(r.promotedSlug ? { status: "promoted", roomSlug: r.promotedSlug } : {}) } : x)));
        if (r.promotedSlug) toast(t("propose_promoted"));
    };

    return (
        <div>
            <div className="glass flex gap-2 rounded-2xl p-2">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, PROPOSAL_MAX_LEN))}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder={t("propose_placeholder")}
                    className="min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-dim"
                />
                <button onClick={submit} disabled={busy || !title.trim()} className="btn-star rounded-xl px-4 text-sm font-semibold disabled:opacity-50">
                    {t("propose_submit")}
                </button>
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">{t("propose_list_title")}</h2>
            {list.length === 0 && <p className="py-8 text-center text-sm text-dim">{t("propose_empty")}</p>}
            <ul className="grid gap-2">
                {list.map((p) => {
                    // 막대는 지금 1위 제안 대비 (매달 1위가 새 주제가 됨)
                    const top = Math.max(1, ...list.filter((x) => x.status === "open").map((x) => x.empathyCount));
                    const pct = p.status === "open" ? Math.min(100, Math.round((p.empathyCount / top) * 100)) : 100;
                    return (
                        <li key={p.id} className="glass relative overflow-hidden rounded-2xl px-4 py-3">
                            <div className="absolute inset-y-0 left-0 bg-star/10" style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] text-ink">{p.title}</p>
                                    <p className="text-xs text-muted">
                                        {p.status === "promoted" && p.roomSlug ? (
                                            <Link href={langPath(lang, `/room/${p.roomSlug}`)} className="inline-flex items-center gap-1 text-star-soft">
                                                {t("propose_promoted")} <ArrowRight size={12} />
                                            </Link>
                                        ) : (
                                            t("propose_progress", { n: p.empathyCount })
                                        )}
                                    </p>
                                </div>
                                {p.status === "open" && (
                                    <button
                                        onClick={() => toggle(p)}
                                        aria-pressed={p.empathized}
                                        className={`flex h-9 items-center gap-1 rounded-full px-3 text-sm ${p.empathized ? "btn-star font-semibold" : "border border-line text-muted"}`}
                                    >
                                        <Heart size={14} className={p.empathized ? "fill-current" : ""} /> {p.empathyCount}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
