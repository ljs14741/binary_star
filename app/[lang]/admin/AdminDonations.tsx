"use client";
// 관리자: 카카오페이 후원 내역 직접 입력·삭제 (화면엔 이름 가운데를 가려서 보임)
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { maskDonorName, type AdminDonation } from "@/lib/donations-shared";

function today(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function AdminDonations({ adminKey }: { adminKey: string }) {
    const [items, setItems] = useState<AdminDonation[] | null>(null);
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(today);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const call = useCallback(
        async (body: Record<string, unknown>) => {
            const r = await api<{ items: AdminDonation[] }>("/api/admin/donation", { method: "POST", json: { key: adminKey, ...body } });
            if (r.ok) setItems(r.items);
            return r;
        },
        [adminKey]
    );
    useEffect(() => {
        let alive = true;
        api<{ items: AdminDonation[] }>("/api/admin/donation", { method: "POST", json: { key: adminKey, action: "list" } }).then((r) => {
            if (alive && r.ok) setItems(r.items);
        });
        return () => {
            alive = false;
        };
    }, [adminKey]);

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const r = await call({ action: "add", name, amount: Number(amount.replace(/[,\s원]/g, "")), date });
        setBusy(false);
        if (!r.ok) return setError(r.error ?? "저장 실패");
        setName("");
        setAmount("");
    };
    const del = async (d: AdminDonation) => {
        if (!confirm(`${d.donor_name}님 ${d.amount.toLocaleString()}원 내역을 지울까요?`)) return;
        await call({ action: "delete", id: d.id });
    };
    const total = items?.reduce((s, d) => s + d.amount, 0) ?? 0;
    const input = "h-9 rounded-xl border border-line bg-card px-2.5 text-[13px] text-ink outline-none";

    return (
        <div className="mt-2 rounded-2xl bg-card p-3 text-[12px]">
            <form onSubmit={add} className="flex flex-wrap gap-1.5">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="이름 (예: 김민수)" className={`${input} w-28`} />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="금액" className={`${input} w-24`} />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-36`} />
                <button disabled={busy || !name.trim() || !amount.trim()} className="btn-star h-9 rounded-full px-4 text-[12px] font-semibold disabled:opacity-40">
                    추가
                </button>
            </form>
            {error && <p className="mt-1.5 text-rose">{error}</p>}
            <p className="mt-2 text-dim">
                화면엔 {name.trim() ? `"${maskDonorName(name)}님"` : "김*수님"} 처럼 가려서 보여요 · 총 {items?.length ?? 0}건 {total.toLocaleString()}원
            </p>
            <ul className="mt-2 space-y-1">
                {items?.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded-xl bg-night/40 px-2.5 py-1.5">
                        <span className="text-ink">
                            {d.donor_name} <span className="text-dim">({maskDonorName(d.donor_name)})</span>
                        </span>
                        <span className="flex items-center gap-2 text-muted">
                            {d.amount.toLocaleString()}원 · {d.date}
                            <button onClick={() => del(d)} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-rose">
                                지우기
                            </button>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
