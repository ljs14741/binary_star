"use client";
// 방명록: 위에 쓰는 칸, 아래 최신순 목록 + 운영자 답글. 별명은 헤더 별명 그대로
import { useState, useSyncExternalStore } from "react";
import { Flag, MessageCircleHeart } from "lucide-react";
import type { GuestbookEntry } from "@/lib/guestbook";
import { GUESTBOOK_MAX_LEN } from "@/lib/guestbook-shared";
import { api, getNickname, NICK_EVENT } from "@/lib/client";
import { flagEmoji, formatDate } from "@/lib/format";
import { useLang, useT } from "./I18nProvider";
import { useToast } from "./Toast";
import { useDialog } from "./Dialog";
import CrisisNotice from "./CrisisNotice";

function subscribeNick(cb: () => void) {
    window.addEventListener("storage", cb);
    window.addEventListener(NICK_EVENT, cb);
    return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(NICK_EVENT, cb);
    };
}

export default function GuestbookBoard({ initial, initialMore }: { initial: GuestbookEntry[]; initialMore: boolean }) {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const { confirm } = useDialog();
    const nick = useSyncExternalStore(subscribeNick, getNickname, () => "");
    const [items, setItems] = useState(initial);
    const [more, setMore] = useState(initialMore);
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [crisis, setCrisis] = useState(false);
    const [reported, setReported] = useState<Set<number>>(new Set());

    const submit = async () => {
        if (busy || !body.trim()) return;
        setBusy(true);
        const r = await api<{ entry: GuestbookEntry; crisis: boolean }>("/api/guestbook", { method: "POST", json: { body, nickname: nick, lang } });
        setBusy(false);
        if (!r.ok) {
            const e = r.error;
            return toast(
                e === "limit"
                    ? t("write_err_limit")
                    : e === "url"
                      ? t("write_err_url")
                      : e === "banned"
                        ? t("write_err_banned")
                        : e === "too_long"
                          ? t("write_err_long", { max: GUESTBOOK_MAX_LEN })
                          : e === "nickname"
                            ? t("nickname_err")
                            : t("write_err_generic"),
            );
        }
        setBody("");
        if (r.crisis) setCrisis(true);
        else setItems((l) => [r.entry, ...l]);
        toast(t("guestbook_done"));
    };

    const loadMore = async () => {
        const last = items[items.length - 1];
        if (!last) return;
        const r = await api<{ items: GuestbookEntry[]; more: boolean }>(`/api/guestbook?before=${last.id}`);
        if (!r.ok) return toast(t("error_generic"));
        setItems((l) => [...l, ...r.items.filter((x) => !l.some((y) => y.id === x.id))]);
        setMore(r.more);
    };

    const report = async (e: GuestbookEntry) => {
        if (!(await confirm({ body: t("guestbook_report_q"), ok: t("wish_report"), danger: true }))) return;
        const r = await api<{ hidden: boolean }>(`/api/guestbook/${e.id}/report`, { method: "POST" });
        setReported((s) => new Set(s).add(e.id));
        if (r.ok && r.hidden) setItems((l) => l.filter((x) => x.id !== e.id));
        toast(r.ok || r.error === "dup" ? t("report_done") : t("error_generic"));
    };

    const when = (iso: string) => formatDate(iso, lang, { dateStyle: "medium", timeStyle: "short" });

    return (
        <div>
            <div className="glass rounded-2xl p-3">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, GUESTBOOK_MAX_LEN))}
                    placeholder={t("guestbook_placeholder")}
                    rows={3}
                    className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-dim focus:outline-none"
                />
                <div className="mt-1 flex items-center gap-2 text-[12px] text-dim">
                    <span className="truncate">{t("guestbook_as", { name: nick || t("anonymous_name") })}</span>
                    <span className="ml-auto shrink-0">
                        {body.length}/{GUESTBOOK_MAX_LEN}
                    </span>
                    <button onClick={submit} disabled={busy || !body.trim()} className="btn-star shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
                        {t("guestbook_submit")}
                    </button>
                </div>
            </div>
            {crisis && (
                <div className="mt-3">
                    <CrisisNotice />
                </div>
            )}

            {items.length === 0 ? (
                <p className="mt-8 text-center text-sm text-dim">{t("guestbook_empty")}</p>
            ) : (
                <ul className="mt-4 space-y-2.5">
                    {items.map((e) => (
                        <li key={e.id} className="rounded-2xl bg-card px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[12px] text-dim">
                                <span className="font-medium text-star-soft">{e.nickname || t("anonymous_name")}</span>
                                {e.country && <span>{flagEmoji(e.country)}</span>}
                                <span>· {when(e.at)}</span>
                                {!e.mine && (
                                    <button onClick={() => report(e)} disabled={reported.has(e.id)} aria-label={t("wish_report")} className="ml-auto rounded-full p-1 text-dim hover:text-ink disabled:opacity-40">
                                        <Flag size={12} />
                                    </button>
                                )}
                            </div>
                            <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{e.body}</p>
                            {e.reply && (
                                <div className="mt-2.5 rounded-xl border border-star/25 bg-star/5 px-3 py-2">
                                    <p className="flex items-center gap-1 text-[11px] font-semibold text-star">
                                        <MessageCircleHeart size={12} /> {t("guestbook_reply")}
                                        {e.replyAt && <span className="font-normal text-dim">· {when(e.replyAt)}</span>}
                                    </p>
                                    <p className="mt-1 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink/90">{e.reply}</p>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {more && (
                <button onClick={loadMore} className="mt-4 h-11 w-full rounded-full border border-line text-sm text-muted hover:text-ink">
                    {t("guestbook_more")}
                </button>
            )}
        </div>
    );
}
