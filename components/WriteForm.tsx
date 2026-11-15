"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Link2, Send, Share2, Check, KeyRound } from "lucide-react";
import type { StoryView } from "@/lib/stories";
import { AGE_GROUPS, NICKNAME_MAX_LEN, STORY_MAX_LEN } from "@/lib/site";
import { useLang, useT } from "./I18nProvider";
import { addMineId, api, langPath, setOwnerToken, siteOrigin } from "@/lib/client";
import StoryCard from "./StoryCard";
import ShareSheet, { storyShareTarget } from "./ShareSheet";
import CrisisNotice from "./CrisisNotice";
import { excerpt } from "@/lib/format";

type Done = { story: StoryView; ownerToken: string; masked: boolean; crisis: boolean };

type RoomOpt = { slug: string; title: string };

// translate: 서버에 AI 키가 있어 자동 번역이 켜졌는지 (꺼지면 "번역돼서 보여요" 문구를 안 씀)
export default function WriteForm({ roomSlug: initialSlug, roomTitle: initialTitle, rooms = [], translate = false }: { roomSlug: string; roomTitle: string; rooms?: RoomOpt[]; translate?: boolean }) {
    // 쓰는 중에 주제(별자리)를 바로 바꿀 수 있음. 주소도 같이 바꿔 둠
    const [roomSlug, setRoomSlug] = useState(initialSlug);
    const roomTitle = rooms.find((r) => r.slug === roomSlug)?.title ?? initialTitle;
    const pickRoom = (slug: string) => {
        setRoomSlug(slug);
        try {
            const u = new URL(location.href);
            u.pathname = u.pathname.replace(/\/room\/[^/]+\/write/, `/room/${slug}/write`);
            history.replaceState(null, "", u.toString());
        } catch {}
    };
    const t = useT();
    const lang = useLang();
    const [body, setBody] = useState("");
    const [age, setAge] = useState<string | null>(null);
    const [nickname, setNickname] = useState("");
    const [linkSaved, setLinkSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [done, setDone] = useState<Done | null>(null);
    const [share, setShare] = useState<"story" | "me" | null>(null);

    useEffect(() => {
        // 쓰다 만 글·마지막 별명 복구 (hydration 뒤 다음 프레임에)
        let raf = 0;
        try {
            const d = sessionStorage.getItem(`draft:${roomSlug}`);
            const n = localStorage.getItem("star_nickname") || "";
            raf = requestAnimationFrame(() => {
                if (d) setBody(d);
                if (n) setNickname(n);
            });
        } catch {}
        return () => cancelAnimationFrame(raf);
    }, [roomSlug]);
    useEffect(() => {
        try {
            sessionStorage.setItem(`draft:${roomSlug}`, body);
        } catch {}
    }, [body, roomSlug]);

    const submit = async () => {
        if (busy) return;
        const text = body.trim();
        if (!text) return setErr(t("write_err_empty"));
        if (text.length > STORY_MAX_LEN) return setErr(t("write_err_long", { max: STORY_MAX_LEN }));
        setErr(null);
        setBusy(true);
        const r = await api<Done>("/api/stories", { method: "POST", json: { room: roomSlug, body: text, nickname: nickname.trim() || null, ageGroup: age, lang } });
        setBusy(false);
        if (!r.ok) {
            const map: Record<string, string> = {
                empty: t("write_err_empty"),
                too_long: t("write_err_long", { max: STORY_MAX_LEN }),
                url: t("write_err_url"),
                banned: t("write_err_banned"),
                rejected: t("write_err_banned"),
                limit: t("write_err_limit"),
                nickname: t("nickname_err"),
            };
            setErr(map[r.error ?? ""] ?? t("write_err_generic"));
            return;
        }
        setOwnerToken(r.ownerToken);
        addMineId(r.story.id);
        try {
            localStorage.setItem("star_nickname", nickname.trim());
        } catch {}
        try {
            sessionStorage.removeItem(`draft:${roomSlug}`);
        } catch {}
        setDone(r);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (done) {
        const meUrl = `${siteOrigin()}${langPath(lang, `/me/${done.ownerToken}`)}`;
        const isPublic = done.story.status === "public";
        return (
            <div className="px-4 pb-10 pt-4">
                <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-1 text-xl font-semibold">
                    {t("after_title")}
                </motion.h1>
                <p className="mb-4 text-sm text-muted">{done.story.status === "pending" ? t("after_pending") : isPublic ? t(translate ? "after_public" : "after_public_local") : t("after_private")}</p>
                {done.crisis && (
                    <div className="mb-4">
                        <CrisisNotice />
                    </div>
                )}
                {done.masked && <p className="mb-3 rounded-xl bg-card px-3 py-2 text-xs text-muted">{t("pii_masked_notice")}</p>}
                <StoryCard story={{ ...done.story, mine: true }} ownerView />
                <p className="mt-2 text-center text-[11px] text-dim">{t("after_edit_window")}</p>
                <div className="mt-5 grid gap-2">
                    {isPublic && (
                        <button onClick={() => setShare("story")} className="btn-star flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
                            <Share2 size={17} /> {t("after_share")}
                        </button>
                    )}
                    <div className={`rounded-2xl border p-3 ${linkSaved ? "border-line" : "border-star/50 bg-star/10"}`}>
                        <p className="mb-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                            <KeyRound size={14} className="mt-0.5 shrink-0 text-star" /> {t("save_link_why")}
                        </p>
                        <button
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(meUrl);
                                    setLinkSaved(true);
                                } catch {}
                                setShare("me");
                            }}
                            className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ${linkSaved ? "glass text-ink" : "btn-star"}`}
                        >
                            {linkSaved ? <Check size={16} /> : <Link2 size={16} />} {linkSaved ? t("copied") : t("save_link_cta")}
                        </button>
                    </div>
                    <Link href={langPath(lang, `/room/${roomSlug}`)} className="mt-2 text-center text-sm text-muted underline-offset-4 hover:underline">
                        {t("after_more")}
                    </Link>
                </div>
                <ShareSheet
                    open={share === "story"}
                    onClose={() => setShare(null)}
                    target={storyShareTarget({ lang, id: done.story.id, roomTitle, count: done.story.empathyCount, countries: 0, t: t as never, excerpt: excerpt(done.story.body) })}
                />
                <ShareSheet open={share === "me"} onClose={() => setShare(null)} target={{ url: meUrl, title: t("me_title"), text: t("me_link_hint") }} />
            </div>
        );
    }

    return (
        <div className="px-4 pb-10 pt-4">
            <p className="mb-1 text-xs text-star-soft">{roomTitle}</p>
            <h1 className="mb-3 text-xl font-semibold">{t("write_title")}</h1>
            {rooms.length > 1 && (
                <div className="mb-4">
                    <p className="mb-1.5 text-xs text-muted">{t("write_room_label")}</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
                        {rooms.map((r) => (
                            <button key={r.slug} type="button" onClick={() => pickRoom(r.slug)} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] transition ${r.slug === roomSlug ? "btn-star font-semibold" : "glass text-muted"}`}>
                                {r.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, STORY_MAX_LEN + 50))}
                placeholder={t("write_placeholder")}
                rows={8}
                maxLength={STORY_MAX_LEN + 50}
                className="story-body glass w-full resize-y rounded-2xl p-4 text-ink placeholder:text-dim"
                style={{ minHeight: 220 }}
            />
            <div className="mt-1 flex justify-end text-[11px] text-dim">
                <span className={body.length > STORY_MAX_LEN ? "text-rose" : ""}>{t("write_count", { n: body.length, max: STORY_MAX_LEN })}</span>
            </div>

            <p className="mb-2 mt-4 text-sm text-muted">{t("nickname_label")}</p>
            <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX_LEN))}
                placeholder={t("nickname_placeholder")}
                maxLength={NICKNAME_MAX_LEN}
                className="glass w-full rounded-2xl px-4 py-2.5 text-[15px] text-ink placeholder:text-dim"
            />

            <p className="mb-2 mt-4 text-sm text-muted">{t("write_age")}</p>
            <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((g) => (
                    <button
                        key={g}
                        type="button"
                        onClick={() => setAge(age === g ? null : g)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${age === g ? "btn-star font-semibold" : "glass text-muted"}`}
                    >
                        {t(`age_${g}` as "age_20s")}
                    </button>
                ))}
            </div>

            {err && <p className="mt-4 rounded-xl bg-rose/10 px-3 py-2 text-sm text-rose">{err}</p>}

            <button onClick={submit} disabled={busy} className="btn-star mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-60">
                <Send size={16} /> {busy ? t("write_submitting") : t("write_submit")}
            </button>
            <p className="mt-3 text-center text-[11px] text-dim">{t(translate ? "anon_notice" : "anon_notice_local")}</p>
            <p className="mt-1.5 text-center text-[11px] text-dim">{t("write_edit_window")}</p>
        </div>
    );
}
