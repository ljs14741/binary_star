"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Share2, ChevronDown, Flame, Languages, Pencil, Trash2, EyeOff, Eye, Sparkles } from "lucide-react";
import type { StoryView } from "@/lib/stories";
import type { Lang } from "@/lib/i18n/config";
import { useLang, useT } from "./I18nProvider";
import EmpathyButton from "./EmpathyButton";
import ShareSheet, { storyShareTarget } from "./ShareSheet";
import ReportSheet from "./ReportSheet";
import { useToast } from "./Toast";
import { useDialog } from "./Dialog";
import { api, langPath } from "@/lib/client";
import { countryName, flagEmoji, formatNumber, excerpt, relTime } from "@/lib/format";
import { RISING_MIN, STORY_MAX_LEN } from "@/lib/site";

type Props = {
    story: StoryView;
    sharedFirst?: boolean;
    onNext?: () => void;
    onHidden?: (id: number) => void;
    compact?: boolean; // 1위·결과 화면용 (버튼 작게, 다음 버튼 없음)
    showRoom?: boolean;
    ownerView?: boolean; // 내 카드 (상태·수정·삭제·내리기, 공감 버튼 없음)
    onOwnerChange?: (s: StoryView | null) => void; // 수정/내리기 결과(null = 삭제됨)
};

export default function StoryCard({ story: initial, sharedFirst, onNext, onHidden, compact, showRoom, ownerView, onOwnerChange }: Props) {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const { confirm } = useDialog();
    const [story, setStory] = useState(initial);
    const [expanded, setExpanded] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [share, setShare] = useState(false);
    const [report, setReport] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(initial.body);
    const [busy, setBusy] = useState(false);
    const [translation, setTranslation] = useState(initial.translation);

    const foreign = story.lang !== lang;
    // 다른 언어 글이면 번역본 가져옴 (캐시 없을 때만 호출)
    useEffect(() => {
        if (!foreign || translation) return;
        let alive = true;
        api<{ translation: StoryView["translation"] }>(`/api/stories/${story.id}/translation?lang=${lang}`).then((r) => {
            if (alive && r.ok) setTranslation(r.translation);
        });
        return () => {
            alive = false;
        };
    }, [foreign, translation, story.id, lang]);

    const usingTranslation = foreign && translation && !translation.pending && !showOriginal;
    const body = usingTranslation ? translation!.body : story.body;
    const long = body.length > 110 || body.split("\n").length > 3;
    const fromName = t(`lang_name_${story.lang}` as "lang_name_ko");
    const where = story.country ? `${flagEmoji(story.country)} ${countryName(story.country, lang as Lang)}` : t("country_unknown");

    // ----- 주인 기능 -----
    const ownerCall = async (init: Parameters<typeof api>[1], okMsg?: string) => {
        if (busy) return;
        setBusy(true);
        const r = await api<{ story?: StoryView }>(`/api/stories/${story.id}`, { ...init, headers: { "Content-Type": "application/json" } });
        setBusy(false);
        if (!r.ok) {
            const map: Record<string, string> = { expired: t("edit_expired"), banned: t("write_err_banned"), url: t("write_err_url"), empty: t("write_err_empty"), too_long: t("write_err_long", { max: STORY_MAX_LEN }) };
            toast(map[r.error ?? ""] ?? t("error_generic"));
            return null;
        }
        if (okMsg) toast(okMsg);
        return r;
    };
    const saveEdit = async () => {
        const r = await ownerCall({ method: "PATCH", json: { action: "edit", body: draft, lang } }, t("done_generic"));
        if (r?.story) {
            setStory(r.story);
            setEditing(false);
            onOwnerChange?.(r.story);
        }
    };
    const remove = async () => {
        if (!(await confirm({ title: t("me_delete"), body: t("confirm_delete"), ok: t("me_delete"), danger: true }))) return;
        const r = await ownerCall({ method: "DELETE" }, t("done_generic"));
        if (r) onOwnerChange?.(null);
    };
    const withdraw = async (down: boolean) => {
        if (down && !(await confirm({ title: t("me_withdraw"), body: t("confirm_withdraw"), ok: t("me_withdraw") }))) return;
        const r = await ownerCall({ method: "PATCH", json: { action: down ? "withdraw" : "restore", lang } }, t("done_generic"));
        if (r?.story) {
            setStory(r.story);
            onOwnerChange?.(r.story);
        }
    };

    return (
        <article className={`fade-in glass relative w-full rounded-3xl ${compact ? "p-4" : "p-5"}`}>
            {(sharedFirst || showRoom || story.isSeed) && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {sharedFirst && <span className="rounded-full bg-star/15 px-2 py-0.5 text-star-soft">{t("shared_first")}</span>}
                    {showRoom && story.roomSlug && (
                        <Link href={langPath(lang, `/room/${story.roomSlug}`)} className="rounded-full border border-line px-2 py-0.5 text-muted">
                            {story.roomTitle}
                        </Link>
                    )}
                    {story.isSeed && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-dim">{t("test_badge")}</span>}
                </div>
            )}

            {/* 별명 · 시간 */}
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                <Sparkles size={12} className="text-star" />
                <span className="font-medium text-ink/90">{story.nickname || t("anonymous_name")}</span>
                <span className="text-dim">·</span>
                <time dateTime={story.createdAt} className="text-dim">
                    {relTime(story.createdAt, lang)}
                </time>
                {story.editedAt && <span className="text-dim">· {t("edited_mark")}</span>}
            </div>

            {foreign && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
                    <Languages size={12} />
                    {translation?.pending || !translation ? (
                        <span>{t("translation_pending")}</span>
                    ) : (
                        <>
                            <span>
                                {flagEmoji(story.country)} {t("translated_from", { lang: fromName })}
                            </span>
                            <button onClick={() => setShowOriginal((v) => !v)} className="underline decoration-dotted underline-offset-2">
                                {showOriginal ? t("view_translation") : t("view_original")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {editing ? (
                <div>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, STORY_MAX_LEN))} rows={6} className="story-body w-full resize-y rounded-2xl border border-line bg-night/60 p-3 text-ink" />
                    <div className="mt-2 flex justify-end gap-2 text-sm">
                        <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-muted">
                            {t("edit_cancel")}
                        </button>
                        <button onClick={saveEdit} disabled={busy} className="btn-star rounded-full px-4 py-1.5 font-semibold disabled:opacity-60">
                            {t("edit_save")}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* 펼쳤을 때 너무 길면 본문 안에서 스크롤 → 공감 버튼은 항상 보임 */}
                    <div className={expanded && !compact && !ownerView ? "max-h-[50dvh] overflow-y-auto pr-1" : ""}>
                        <p className={`story-body ${!expanded && long ? "clamp-3" : ""}`}>{body}</p>
                    </div>
                    {long && !expanded && (
                        <button onClick={() => setExpanded(true)} className="mt-1 flex items-center gap-0.5 text-sm text-star-soft">
                            {t("more")} <ChevronDown size={14} />
                        </button>
                    )}
                    {expanded && long && (
                        <button onClick={() => setExpanded(false)} className="mt-1 text-sm text-muted">
                            {t("less")}
                        </button>
                    )}
                </>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{[story.ageGroup ? t(`age_${story.ageGroup}` as "age_20s") : null, where].filter(Boolean).join(" · ")}</span>
                <span className="text-dim">·</span>
                <span>{story.empathyCount === 0 ? t("empathy_zero") : t("empathy_count", { n: formatNumber(story.empathyCount, lang) })}</span>
                {story.countryCount > 0 && <span>{t("story_countries", { n: story.countryCount })}</span>}
                {story.rising24h >= RISING_MIN && (
                    <span className="flex items-center gap-0.5 rounded-full bg-rose/15 px-1.5 py-0.5 text-rose">
                        <Flame size={11} /> {t("rising", { n: story.rising24h })}
                    </span>
                )}
            </div>

            {ownerView ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${story.status === "public" ? "bg-star/15 text-star-soft" : "border border-line text-muted"}`}>
                        {t(`me_status_${story.status}` as "me_status_public")}
                    </span>
                    <span className="flex-1" />
                    {story.canEdit && !editing && (
                        <>
                            <button onClick={() => { setDraft(story.body); setEditing(true); }} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">
                                <Pencil size={12} /> {t("me_edit")}
                            </button>
                            <button onClick={remove} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted hover:text-rose">
                                <Trash2 size={12} /> {t("me_delete")}
                            </button>
                        </>
                    )}
                    {story.status === "public" && (
                        <button onClick={() => withdraw(true)} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">
                            <EyeOff size={12} /> {t("me_withdraw")}
                        </button>
                    )}
                    {story.status === "withdrawn" && (
                        <button onClick={() => withdraw(false)} className="flex items-center gap-1 rounded-full border border-star/40 px-2.5 py-1 text-star-soft">
                            <Eye size={12} /> {t("me_restore")}
                        </button>
                    )}
                    {story.status === "public" && (
                        <button onClick={() => setShare(true)} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">
                            <Share2 size={12} /> {t("share")}
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-4 flex items-center gap-2">
                    <EmpathyButton
                        storyId={story.id}
                        count={story.empathyCount}
                        empathized={story.empathized}
                        mine={story.mine}
                        size={compact ? "sm" : "lg"}
                        onChange={(n) => setStory((s) => ({ ...s, empathyCount: n.count, empathized: n.empathized }))}
                    />
                    {!compact && onNext && (
                        <button onClick={onNext} className="h-12 shrink-0 whitespace-nowrap rounded-full border border-line px-4 text-sm text-ink hover:bg-card-strong">
                            {t("story_next")} →
                        </button>
                    )}
                    {!compact && story.empathized && !story.mine && story.roomSlug && (
                        <Link href={langPath(lang, `/room/${story.roomSlug}/write`)} className="fade-in absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-star/20 px-3 py-1 text-[11px] text-star-soft">
                            {t("nudge_write")} →
                        </Link>
                    )}
                    <button onClick={() => setShare(true)} aria-label={t("story_share")} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink">
                        <Share2 size={18} />
                    </button>
                    {!story.mine && (
                        <button onClick={() => setReport(true)} aria-label={t("story_report")} title={t("report_title")} className="flex h-10 items-center justify-center gap-1 rounded-full px-2 text-[11px] text-dim hover:text-ink">
                            <Flag size={14} /> {t("story_report_label")}
                        </button>
                    )}
                </div>
            )}

            <ShareSheet
                open={share}
                onClose={() => setShare(false)}
                target={storyShareTarget({ lang, id: story.id, roomTitle: story.roomTitle, count: story.empathyCount, countries: story.countryCount, t: t as never, excerpt: excerpt(story.body) })}
            />
            <ReportSheet storyId={story.id} open={report} onClose={() => setReport(false)} onHidden={() => onHidden?.(story.id)} />
        </article>
    );
}
