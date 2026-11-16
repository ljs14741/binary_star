"use client";
// 관리자: 방명록 (숨김·공개·지우기·답글). 위기 낱말(본인만)·신고된 것도 보임
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { flagEmoji, formatDate } from "@/lib/format";
import type { AdminGuestbook as Entry } from "@/lib/guestbook";

export default function AdminGuestbook({ adminKey }: { adminKey: string }) {
    const [items, setItems] = useState<Entry[] | null>(null);
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const call = useCallback(
        async (body: Record<string, unknown>) => {
            const r = await api<{ items: Entry[] }>("/api/admin/guestbook", { method: "POST", json: { key: adminKey, ...body } });
            if (r.ok) setItems(r.items);
            return r.ok;
        },
        [adminKey],
    );
    useEffect(() => {
        let alive = true;
        api<{ items: Entry[] }>("/api/admin/guestbook", { method: "POST", json: { key: adminKey, action: "list" } }).then((r) => {
            if (alive && r.ok) setItems(r.items);
        });
        return () => {
            alive = false;
        };
    }, [adminKey]);
    const btn = "rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink";
    if (!items) return <p className="mt-2 text-[12px] text-dim">불러오는 중…</p>;
    if (items.length === 0) return <p className="mt-2 text-[12px] text-dim">아직 방명록이 없어요</p>;
    return (
        <ul className="mt-2 space-y-1.5 text-[12px]">
            {items.map((g) => {
                const draft = drafts[g.id] ?? g.reply ?? "";
                return (
                    <li key={g.id} className="rounded-xl bg-card px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-dim">
                            #{g.id} · {g.nickname ?? "익명"} {g.country && flagEmoji(g.country)} · {g.lang} · {formatDate(g.at, "ko", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                            <span className={g.status === "public" ? "text-star-soft" : "text-rose"}>{g.status === "private" ? "위기 낱말(본인만)" : g.status === "hidden" ? "숨김" : "공개"}</span>
                            {g.reports > 0 && <span className="text-rose">신고 {g.reports}</span>}
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words text-[13px] text-ink">{g.body}</p>
                        {/* 답글: 비우고 저장하면 답글 지움 */}
                        <div className="mt-1.5 flex gap-1.5">
                            <input
                                value={draft}
                                onChange={(e) => setDrafts((d) => ({ ...d, [g.id]: e.target.value }))}
                                placeholder="답글 (비우고 저장하면 지움)"
                                className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 py-1 text-[12px] text-ink placeholder:text-dim"
                            />
                            <button onClick={() => call({ action: "reply", id: g.id, reply: draft })} className={btn} disabled={draft === (g.reply ?? "")}>
                                답글 저장
                            </button>
                        </div>
                        <div className="mt-1.5 flex gap-1.5">
                            {g.status === "public" ? (
                                <button onClick={() => call({ action: "hide", id: g.id })} className={btn}>
                                    숨기기
                                </button>
                            ) : (
                                <button onClick={() => call({ action: "unhide", id: g.id })} className={btn}>
                                    공개
                                </button>
                            )}
                            <button onClick={() => confirm(`#${g.id} 방명록 글을 지울까요?`) && call({ action: "remove", id: g.id })} className={`${btn} text-rose`}>
                                지우기
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
