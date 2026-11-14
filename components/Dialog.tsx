"use client";
// 분위기에 맞춘 확인창·복사창 (브라우저 기본 confirm/prompt 대신). useDialog() 로 씀
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Sparkles } from "lucide-react";
import { useT } from "./I18nProvider";

type ConfirmOpts = { title?: string; body: string; ok?: string; cancel?: string; danger?: boolean };
type CopyOpts = { title: string; value: string };
type Ctx = { confirm: (o: ConfirmOpts) => Promise<boolean>; showCopy: (o: CopyOpts) => void };
const DialogCtx = createContext<Ctx>({ confirm: async () => false, showCopy: () => {} });

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const t = useT();
    const [cf, setCf] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
    const [cp, setCp] = useState<CopyOpts | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setCf({ ...o, resolve })), []);
    const showCopy = useCallback((o: CopyOpts) => setCp(o), []);
    const closeCf = (v: boolean) => {
        cf?.resolve(v);
        setCf(null);
    };

    useEffect(() => {
        if (!cf && !cp) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (cf) closeCf(false);
                setCp(null);
            }
            if (e.key === "Enter" && cf) closeCf(true);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cf, cp]);

    useEffect(() => {
        if (cp) setTimeout(() => inputRef.current?.select(), 50);
    }, [cp]);

    const open = !!cf || !!cp;
    return (
        <DialogCtx.Provider value={{ confirm, showCopy }}>
            {children}
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-night/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => (cf ? closeCf(false) : setCp(null))} role="presentation">
                        <motion.div
                            initial={{ y: 24, scale: 0.98, opacity: 0 }}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            exit={{ y: 12, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal
                            className="relative w-full max-w-[400px] overflow-hidden rounded-3xl border border-star/25 bg-night p-5 shadow-glow"
                        >
                            {/* 위쪽 은은한 별빛 */}
                            <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-star/15 blur-2xl" />
                            <Sparkles size={18} className="mb-3 text-star" />
                            {cf && (
                                <>
                                    {cf.title && <p className="mb-1 text-base font-semibold text-ink">{cf.title}</p>}
                                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{cf.body}</p>
                                    <div className="mt-5 flex gap-2">
                                        <button onClick={() => closeCf(false)} className="glass h-11 flex-1 rounded-full text-sm text-ink">
                                            {cf.cancel ?? t("dialog_cancel")}
                                        </button>
                                        <button onClick={() => closeCf(true)} className={`h-11 flex-1 rounded-full text-sm font-semibold ${cf.danger ? "bg-rose/90 text-night" : "btn-star"}`}>
                                            {cf.ok ?? t("dialog_ok")}
                                        </button>
                                    </div>
                                </>
                            )}
                            {cp && (
                                <>
                                    <p className="mb-1 text-base font-semibold text-ink">{cp.title}</p>
                                    <p className="mb-3 text-xs text-muted">{t("dialog_copy_hint")}</p>
                                    <input ref={inputRef} readOnly value={cp.value} onFocus={(e) => e.target.select()} className="glass w-full rounded-2xl px-3 py-2.5 text-[13px] text-ink" />
                                    <div className="mt-4 flex gap-2">
                                        <button onClick={() => setCp(null)} className="glass h-11 flex-1 rounded-full text-sm text-ink">
                                            {t("dialog_close")}
                                        </button>
                                        <button
                                            onClick={() => {
                                                inputRef.current?.select();
                                                try {
                                                    document.execCommand("copy");
                                                } catch {}
                                            }}
                                            className="btn-star flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold"
                                        >
                                            <Copy size={15} /> {t("dialog_copy")}
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DialogCtx.Provider>
    );
}

export function useDialog() {
    return useContext(DialogCtx);
}
