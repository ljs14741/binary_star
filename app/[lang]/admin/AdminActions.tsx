"use client";
// 관리자 글 조치 버튼 (숨기기 · 공개 · 내리기). 끝나면 새로고침해서 숫자도 같이 갱신
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function AdminActions({ id, status, adminKey }: { id: number; status: string; adminKey: string }) {
    const [busy, setBusy] = useState(false);
    const router = useRouter();
    const run = async (action: "hide" | "unhide" | "remove") => {
        if (action === "remove" && !confirm(`#${id} 글을 완전히 내릴까요? 되돌릴 수 없어요`)) return;
        setBusy(true);
        const r = await api("/api/admin/story", { method: "POST", json: { key: adminKey, id, action } });
        setBusy(false);
        if (!r.ok) return alert(`실패: ${r.error}`);
        router.refresh();
    };
    const btn = "rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:text-ink disabled:opacity-40";
    return (
        <div className="flex gap-1.5">
            {status === "public" && <button disabled={busy} onClick={() => run("hide")} className={btn}>숨기기</button>}
            {(status === "hidden" || status === "private" || status === "withdrawn") && <button disabled={busy} onClick={() => run("unhide")} className={btn}>공개</button>}
            <button disabled={busy} onClick={() => run("remove")} className={`${btn} text-rose`}>내리기</button>
        </div>
    );
}
