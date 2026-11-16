"use client";
// 헤더의 내 별명. 처음 들어오면 자동으로 하나 정해지고, 누르면 바꾸기 창
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, UserRound, X } from "lucide-react";
import { useLang, useT } from "./I18nProvider";
import { ensureNickname, getNickname, NICK_EVENT, setNickname } from "@/lib/client";
import { checkNickname, randomNickname } from "@/lib/nickname";
import { NICKNAME_MAX_LEN } from "@/lib/site";

function subscribe(cb: () => void) {
    window.addEventListener("storage", cb);
    window.addEventListener(NICK_EVENT, cb);
    return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(NICK_EVENT, cb);
    };
}

export default function NicknameChip() {
    const lang = useLang();
    const t = useT();
    const nick = useSyncExternalStore(subscribe, getNickname, () => "");
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");

    useEffect(() => {
        ensureNickname(() => randomNickname(lang));
    }, [lang]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const bad = !checkNickname(draft).ok;
    const openSheet = () => {
        setDraft(nick);
        setOpen(true);
    };
    const save = () => {
        if (bad) return;
        setNickname(draft);
        setOpen(false);
    };

    return (
        <>
            <button data-tour="nick" onClick={openSheet} title={t("nickname_change")} className="flex min-w-0 max-w-[7.5rem] items-center sm:max-w-[9.5rem] gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-muted hover:text-ink">
                <UserRound size={13} className="shrink-0 text-star-soft" />
                <span className="truncate">{nick || t("anonymous_name")}</span>
            </button>
            {/* 폰 키보드가 올라와도 가리지 않게 화면 위쪽(헤더 바로 아래)에 붙는 창. 헤더(블러) 밖 body 에 그려야 화면 전체를 덮음 */}
            {typeof document !== "undefined" &&
                createPortal(
                    <AnimatePresence>
                        {open && (
                            <>
                                <motion.div className="fixed inset-0 z-[60] bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
                                <motion.div
                                    role="dialog"
                                    aria-modal
                                    aria-label={t("nickname_change")}
                                    initial={{ y: -16, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -12, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                    className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-[61] mx-auto max-w-[440px] rounded-3xl border border-star/25 bg-night p-4 shadow-glow"
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-base font-semibold text-ink">{t("nickname_change")}</h3>
                                        <button onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-full p-1 text-muted hover:text-ink">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value.slice(0, NICKNAME_MAX_LEN))}
                                            onKeyDown={(e) => e.key === "Enter" && save()}
                                            placeholder={t("anonymous_name")}
                                            maxLength={NICKNAME_MAX_LEN}
                                            enterKeyHint="done"
                                            className="glass min-w-0 flex-1 rounded-2xl px-4 py-2.5 text-[16px] text-ink placeholder:text-dim"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setDraft(randomNickname(lang, Math.random, draft))}
                                            className="glass flex shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[13px] text-muted active:scale-95"
                                        >
                                            <Dices size={16} /> {t("nickname_reroll")}
                                        </button>
                                    </div>
                                    <p className={`mt-1.5 text-[11px] ${bad ? "text-rose" : "text-dim"}`}>{bad ? t("nickname_err") : t("nickname_sheet_hint")}</p>
                                    <button onClick={save} disabled={bad} className="btn-star mt-3 h-11 w-full rounded-full text-sm font-semibold disabled:opacity-50">
                                        {t("nickname_save")}
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}
        </>
    );
}
