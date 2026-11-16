"use client";
// 관리자: 실시간 언덕 현황. 화면을 보고 있을 때만 5초마다 갱신
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { flagEmoji, formatDate } from "@/lib/format";
import type { LivePresence } from "@/lib/hill";

const POLL_MS = 5000;

export default function AdminLive({ adminKey }: { adminKey: string }) {
    const [live, setLive] = useState<LivePresence | null | undefined>(undefined);
    const [at, setAt] = useState<Date | null>(null);
    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (document.visibilityState !== "visible") return;
            const r = await api<{ live: LivePresence | null }>("/api/admin/live", { method: "POST", json: { key: adminKey } });
            if (!alive || !r.ok) return;
            setLive(r.live);
            setAt(new Date());
        };
        void load();
        const iv = setInterval(load, POLL_MS);
        document.addEventListener("visibilitychange", load);
        return () => {
            alive = false;
            clearInterval(iv);
            document.removeEventListener("visibilitychange", load);
        };
    }, [adminKey]);

    if (live === undefined) return <p className="mt-2 text-[12px] text-dim">불러오는 중…</p>;
    if (live === null) return <p className="mt-2 text-[12px] text-rose">실시간 서버에 연결 못 함</p>;
    // 사람 있는 언덕만. 빈 언덕은 개수로만
    const open = live.hills.filter((h) => h.count > 0);
    const countries = Object.entries(live.countries).sort((a, b) => b[1] - a[1]);
    return (
        <div className="mt-2 rounded-2xl bg-card px-3 py-3 text-[12px]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-xl font-semibold text-ink">{live.total}명</p>
                <p className="text-muted">
                    열린 언덕 {open.length}개 <span className="text-dim">(언덕당 {live.cap}명)</span>
                </p>
                <p className="text-muted">
                    오늘 최고 {live.peak.n}명{live.peak.n > 0 && <span className="text-dim"> · {formatDate(new Date(live.peak.at), "ko", { timeStyle: "short" })}</span>}
                </p>
            </div>
            {open.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                    {open.map((h, i) => (
                        <li key={h.name} className="flex items-center gap-2">
                            <span className="w-12 shrink-0 text-muted">언덕 {i + 1}</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span className="block h-full rounded-full bg-star" style={{ width: `${Math.min(100, (h.count / live.cap) * 100)}%` }} />
                            </span>
                            <span className="w-14 shrink-0 text-right text-ink">
                                {h.count}/{live.cap}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {countries.length > 0 && (
                <p className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-muted">
                    {countries.map(([c, n]) => (
                        <span key={c}>
                            {c === "??" ? "🌐" : flagEmoji(c)} {n}
                        </span>
                    ))}
                </p>
            )}
            <p className="mt-2 text-[10px] text-dim">{at && formatDate(at, "ko", { timeStyle: "medium" })} · 5초마다 갱신 · 오늘 최고는 서버 재시작 뒤부터 셈</p>
        </div>
    );
}
