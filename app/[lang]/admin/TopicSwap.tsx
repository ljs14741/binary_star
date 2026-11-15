"use client";
// 매달 주제 교체 버튼. 12칸이 다 찼으면 조용한 주제를 내리고 1위 제안을 올림, 빈칸이 있으면 그냥 추가
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { SwapPlan } from "@/lib/admin";

export default function TopicSwap({ plan, slots, adminKey }: { plan: SwapPlan; slots: number; adminKey: string }) {
    const [busy, setBusy] = useState(false);
    const router = useRouter();
    const full = plan.openRooms >= slots;
    const run = async () => {
        if (!plan.top) return;
        const msg = full && plan.quietest ? `"${plan.quietest.title}" 을(를) 지난 주제로 내리고 "${plan.top.title}" 을(를) 새 주제로 올릴까요?` : `"${plan.top.title}" 을(를) 새 주제로 추가할까요?`;
        if (!confirm(msg)) return;
        setBusy(true);
        const r = await api<{ slug: string }>("/api/admin/topic", { method: "POST", json: { key: adminKey, proposalId: plan.top.id, closeRoomId: full ? plan.quietest?.id ?? null : null } });
        setBusy(false);
        if (!r.ok) return alert(`실패: ${r.error}`);
        router.refresh();
    };
    return (
        <div className="mt-2 rounded-2xl bg-card p-3 text-[12px]">
            <p className="text-muted">
                열린 주제 {plan.openRooms} / {slots}
            </p>
            <p className="mt-1 text-ink">
                공감 1위 제안: {plan.top ? <b>{plan.top.title}</b> : <span className="text-dim">아직 없음</span>}
                {plan.top && <span className="text-dim"> · 공감 {plan.top.empathy}</span>}
            </p>
            {full && (
                <p className="mt-1 text-ink">
                    내려갈 주제(최근 30일 가장 조용함): {plan.quietest ? <b>{plan.quietest.title}</b> : <span className="text-dim">없음</span>}
                    {plan.quietest && <span className="text-dim"> · 글 {plan.quietest.stories} · 공감 {plan.quietest.empathy}</span>}
                </p>
            )}
            <button disabled={busy || !plan.top || plan.top.empathy < 1} onClick={run} className="btn-star mt-2 rounded-full px-4 py-1.5 text-[12px] font-semibold disabled:opacity-40">
                {full ? "이번 달 주제 바꾸기" : "새 주제로 추가하기"}
            </button>
            <p className="mt-1.5 text-[11px] text-dim">한 달에 한 번 눌러 주세요. 내려간 주제의 글은 남고 읽기만 돼요</p>
        </div>
    );
}
