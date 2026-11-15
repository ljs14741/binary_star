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

export function WishCompose({ open, count, onClose, onSent, onOpenList }: { open: boolean; count: number; onClose: () => void; onSent: (crisis: boolean) => void; onOpenList: () => void }) {
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
                        {/* 오늘 밤 소원 수: 누르면 모두 보기 */}
                        <button type="button" onClick={onOpenList} className="mb-3 text-[12px] text-star-soft underline-offset-2 hover:underline">
                            {t("wish_count", { n: formatNumber(count, lang) })} · {t("wish_all")}
                        </button>
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
        document.body,
    );
}

// 빌어 주기 버튼: 내 소원이면 표시만, 빌어 주면 톡 튀며 채워짐
function CheerButton({ w, onCheer, small }: { w: WishItem; onCheer: (id: number) => void; small?: boolean }) {
    const t = useT();
    const lang = useLang();
    const done = w.cheered;
    if (w.mine)
        return (
            <span className={`inline-flex items-center gap-1 rounded-full border border-star/25 text-dim ${small ? "h-8 px-3 text-[11px]" : "h-11 px-5 text-sm"}`}>
                <MoonStar size={small ? 12 : 15} className="text-star-soft" /> {t("wish_mine")} · 🙏 {formatNumber(w.cheers, lang)}
            </span>
        );
    return (
        <motion.button
            key={done ? "y" : "n"}
            initial={done ? { scale: 0.8 } : false}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 14 }}
            onClick={() => !done && onCheer(w.id)}
            disabled={done}
            aria-pressed={done}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? "h-8 px-3 text-[12px]" : "h-11 px-6 text-sm"} ${done ? "border border-star/50 bg-star/15 text-star" : "btn-star"}`}
        >
            <Heart size={small ? 12 : 15} className={done ? "fill-current" : ""} /> {done ? t("wish_cheered") : t("wish_cheer")} · {formatNumber(w.cheers, lang)}
        </motion.button>
    );
}

export function WishView({ wish, onClose, onCheer, onOpenList }: { wish: WishItem | null; onClose: () => void; onCheer: (id: number) => void; onOpenList: () => void }) {
    const t = useT();
    const [reported, setReported] = useState<number | null>(null);
    const report = async () => {
        if (!wish || reported === wish.id) return;
        setReported(wish.id);
        await api(`/api/wishes/${wish.id}/report`, { method: "POST" });
    };
    return (
        <BottomSheet open={!!wish} onClose={onClose} title={t("wish_from")}>
            {wish && (
                <div>
                    <p className="story-body text-center text-[17px] leading-relaxed text-ink">“{wish.body}”</p>
                    <div className="mt-5 flex justify-center">
                        <CheerButton w={wish} onCheer={onCheer} />
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-[12px]">
                        <button onClick={onOpenList} className="text-star-soft underline-offset-2 hover:underline">
                            {t("wish_all")}
                        </button>
                        {!wish.mine && (
                            <button onClick={report} disabled={reported === wish.id} className="text-dim underline-offset-2 hover:underline disabled:no-underline">
                                {reported === wish.id ? t("wish_reported") : t("wish_report")}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </BottomSheet>
    );
}

// 오늘 밤 소원 모두 보기: 하늘엔 20개까지만 뜨니 여기서 전부
export function WishList({ open, items, onClose, onCheer }: { open: boolean; items: WishItem[]; onClose: () => void; onCheer: (id: number) => void }) {
    const t = useT();
    const lang = useLang();
    return (
        <BottomSheet open={open} onClose={onClose} title={`${t("wish_list_title")} · ${formatNumber(items.length, lang)}`}>
            {items.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-dim">{t("wish_empty")}</p>
            ) : (
                <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {items.map((w) => (
                        <li key={w.id} className="glass flex flex-col gap-2 rounded-2xl px-4 py-3">
                            <p className="story-body text-[15px] leading-relaxed text-ink">🏮 {w.body}</p>
                            <div className="flex justify-end">
                                <CheerButton w={w} onCheer={onCheer} small />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </BottomSheet>
    );
}
