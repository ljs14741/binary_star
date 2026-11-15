"use client";
// 헤더의 내 별명. 처음 들어오면 자동으로 하나 정해지고, 누르면 바꾸기 창
import { useEffect, useState, useSyncExternalStore } from "react";
import { Dices, UserRound } from "lucide-react";
import { useLang, useT } from "./I18nProvider";
import BottomSheet from "./BottomSheet";
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
            <button onClick={openSheet} title={t("nickname_change")} className="flex max-w-[9.5rem] items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-muted hover:text-ink">
                <UserRound size={13} className="shrink-0 text-star-soft" />
                <span className="truncate">{nick || t("anonymous_name")}</span>
            </button>
            <BottomSheet open={open} onClose={() => setOpen(false)} title={t("nickname_change")}>
                <div className="flex gap-2">
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, NICKNAME_MAX_LEN))}
                        onKeyDown={(e) => e.key === "Enter" && save()}
                        placeholder={t("anonymous_name")}
                        maxLength={NICKNAME_MAX_LEN}
                        autoFocus
                        className="glass min-w-0 flex-1 rounded-2xl px-4 py-2.5 text-[15px] text-ink placeholder:text-dim"
                    />
                    <button type="button" onClick={() => setDraft(randomNickname(lang, Math.random, draft))} className="glass flex shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[13px] text-muted active:scale-95">
                        <Dices size={16} /> {t("nickname_reroll")}
                    </button>
                </div>
                <p className={`mt-1.5 text-[11px] ${bad ? "text-rose" : "text-dim"}`}>{bad ? t("nickname_err") : t("nickname_sheet_hint")}</p>
                <button onClick={save} disabled={bad} className="btn-star mt-4 h-11 w-full rounded-full text-sm font-semibold disabled:opacity-50">
                    {t("nickname_save")}
                </button>
            </BottomSheet>
        </>
    );
}
