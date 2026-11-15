"use client";
// 소원 부두 창들: 소원 적기(화면 위쪽 고정 창, 폰 키보드에 안 가림) · 하늘 풍등 눌렀을 때 그 소원 보기
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MoonStar, X } from "lucide-react";
import { useLang, useT } from "@/components/I18nProvider";
import BottomSheet from "@/components/BottomSheet";
import { api } from "@/lib/client";
import { formatNumber } from "@/lib/format";

export type WishItem = { id: number; body: string; cheers: number; cheered: boolean; mine: boolean };
const MAX = 60;

export function WishCompose({ open, count, onClose, onSent }: { open: boolean; count: number; onClose: () => void; onSent: (crisis: boolean) => void }) {
    const t = useT();
    const lang = useLang();
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    const send = async () => {
        if (!text.trim() || busy) return;
        setBusy(true);
        setMsg("");
        const r = await api<{ crisis: boolean }>("/api/wishes", { method: "POST", json: { body: text, lang } });
        setBusy(false);
        if (!r.ok) {
            setMsg(r.error === "limit" ? t("wish_err_limit") : r.error === "url" ? t("wish_err_url") : r.error === "banned" ? t("wish_err_banned") : t("error_generic"));
            return;
        }
        setText("");
        onSent(r.crisis);
    };
    if (typeof document === "undefined") return null;
    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div className="fixed inset-0 z-[60] bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                    <motion.div
                        role="dialog"
                        aria-modal
                        aria-label={t("wish_title")}
                        initial={{ y: -16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -12, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-[61] mx-auto max-w-[440px] rounded-3xl border border-star/25 bg-night p-4 shadow-glow"
                    >
                        <div className="mb-1 flex items-center justify-between">
                            <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                                <MoonStar size={16} className="text-star" /> {t("wish_title")}
                            </h3>
                            <button onClick={onClose} aria-label={t("close")} className="rounded-full p-1 text-muted hover:text-ink">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="mb-3 text-[12px] text-dim">{t("wish_count", { n: formatNumber(count, lang) })}</p>
                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, MAX))}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                            placeholder={t("wish_placeholder")}
                            maxLength={MAX}
                            enterKeyHint="send"
                            className="glass w-full rounded-2xl px-4 py-3 text-[16px] text-ink placeholder:text-dim"
                        />
                        <div className="mt-1 flex justify-between text-[11px] text-dim">
                            <span className={msg ? "text-rose" : ""}>{msg || t("wish_hint")}</span>
                            <span>
                                {text.length}/{MAX}
                            </span>
                        </div>
                        <button onClick={send} disabled={busy || !text.trim()} className="btn-star mt-3 h-11 w-full rounded-full text-sm font-semibold disabled:opacity-50">
                            {t("wish_submit")}
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

export function WishView({ wish, onClose, onCheered }: { wish: WishItem | null; onClose: () => void; onCheered: (id: number, cheers: number) => void }) {
    const t = useT();
    const lang = useLang();
    const [state, setState] = useState<{ id: number; cheers: number; cheered: boolean; reported: boolean } | null>(null);
    const cur = wish && state?.id === wish.id ? state : wish ? { id: wish.id, cheers: wish.cheers, cheered: wish.cheered, reported: false } : null;
    const cheer = async () => {
        if (!wish || !cur || cur.cheered || wish.mine) return;
        setState({ ...cur, cheered: true, cheers: cur.cheers + 1 });
        try {
            navigator.vibrate?.(14);
        } catch {}
        const r = await api<{ cheers: number }>(`/api/wishes/${wish.id}/cheer`, { method: "POST" });
        if (r.ok) onCheered(wish.id, r.cheers);
    };
    const report = async () => {
        if (!wish || !cur || cur.reported) return;
        setState({ ...cur, reported: true });
        await api(`/api/wishes/${wish.id}/report`, { method: "POST" });
    };
    return (
        <BottomSheet open={!!wish} onClose={onClose} title={t("wish_from")}>
            {wish && cur && (
                <div>
                    <p className="story-body text-center text-[17px] leading-relaxed text-ink">“{wish.body}”</p>
                    <button
                        onClick={cheer}
                        disabled={cur.cheered || wish.mine}
                        className={`mx-auto mt-5 flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold ${cur.cheered || wish.mine ? "border border-star/40 text-star-soft" : "btn-star"}`}
                    >
                        <Heart size={15} className={cur.cheered ? "fill-current" : ""} /> {cur.cheered ? t("wish_cheered") : t("wish_cheer")} · {formatNumber(cur.cheers, lang)}
                    </button>
                    {!wish.mine && (
                        <button onClick={report} disabled={cur.reported} className="mx-auto mt-3 block text-[11px] text-dim underline-offset-2 hover:underline disabled:no-underline">
                            {cur.reported ? t("wish_reported") : t("wish_report")}
                        </button>
                    )}
                </div>
            )}
        </BottomSheet>
    );
}
