"use client";
// 관리자 키 한 번 입력 → 이 기기는 90일 동안 /admin 바로 열림
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function AdminLogin() {
    const [key, setKey] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const router = useRouter();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) return;
        setBusy(true);
        const r = await api("/api/admin/login", { method: "POST", json: { key: key.trim() } });
        setBusy(false);
        if (!r.ok) return setMsg(r.error === "limit" ? "잠시 뒤에 다시 해 주세요" : "키가 맞지 않아요");
        router.refresh();
    };
    return (
        <form onSubmit={submit} className="mx-auto mt-16 max-w-[320px] px-4">
            <h1 className="text-lg font-semibold text-ink">관리</h1>
            <p className="mt-1 text-xs text-dim">관리자 키를 한 번 넣으면 이 기기에선 90일 동안 바로 열려요</p>
            <input type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="관리자 키" className="mt-4 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none" />
            <button disabled={busy} className="btn-star mt-2 h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-50">들어가기</button>
            {msg && <p className="mt-2 text-xs text-rose">{msg}</p>}
        </form>
    );
}
