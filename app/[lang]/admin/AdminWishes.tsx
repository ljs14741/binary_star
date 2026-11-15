"use client";
// 관리자: 최근 소원 (숨김·공개·지우기). 위기 낱말(private)·신고된 것도 보임
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { AdminWish } from "@/lib/wishes";

export default function AdminWishes({ adminKey }: { adminKey: string }) {
    const [items, setItems] = useState<AdminWish[] | null>(null);
    const call = useCallback(
        async (body: Record<string, unknown>) => {
            const r = await api<{ items: AdminWish[] }>("/api/admin/wish", { method: "POST", json: { key: adminKey, ...body } });
            if (r.ok) setItems(r.items);
        },
        [adminKey]
    );
    useEffect(() => {
        let alive = true;
        api<{ items: AdminWish[] }>("/api/admin/wish", { method: "POST", json: { key: adminKey, action: "list" } }).then((r) => {
            if (alive && r.ok) setItems(r.items);
        });
        return () => {
            alive = false;
        };
    }, [adminKey]);
    const btn = "rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink";
    if (!items) return <p className="mt-2 text-[12px] text-dim">불러오는 중…</p>;
    if (items.length === 0) return <p className="mt-2 text-[12px] text-dim">아직 소원이 없어요</p>;
    return (
        <ul className="mt-2 space-y-1.5 text-[12px]">
            {items.map((w) => (
                <li key={w.id} className="rounded-xl bg-card px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-dim">
                        #{w.id} · {w.day} · <span className={w.status === "public" ? "text-star-soft" : "text-rose"}>{w.status === "private" ? "위기 낱말(본인만)" : w.status === "hidden" ? "숨김" : "공개"}</span> · 빌어 줄게 {w.cheers}
                        {w.reports > 0 && <span className="text-rose">신고 {w.reports}</span>}
                    </div>
                    <p className="mt-0.5 break-words text-[13px] text-ink">{w.body}</p>
                    <div className="mt-1.5 flex gap-1.5">
                        {w.status === "public" ? <button onClick={() => call({ action: "hide", id: w.id })} className={btn}>숨기기</button> : <button onClick={() => call({ action: "unhide", id: w.id })} className={btn}>공개</button>}
                        <button onClick={() => confirm(`#${w.id} 소원을 지울까요?`) && call({ action: "remove", id: w.id })} className={`${btn} text-rose`}>
                            지우기
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
