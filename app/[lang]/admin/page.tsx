import type { Metadata } from "next";
import { requireLang } from "@/lib/page";
import { isAdmin, getAdminStats, getSwapPlan, TOPIC_SLOTS, type AdminStory } from "@/lib/admin";
import { flagEmoji, formatDate } from "@/lib/format";
import AdminActions from "./AdminActions";
import TopicSwap from "./TopicSwap";
import AdminDonations from "./AdminDonations";
import AdminWishes from "./AdminWishes";
import AdminLive from "./AdminLive";
import AdminLogin from "./AdminLogin";
import AdminRemember from "./AdminRemember";

// 운영자 통계. /ko/admin?key=STAR_ADMIN_KEY 로만 열림 (키 없거나 틀리면 404). 한국어 고정
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리", robots: { index: false, follow: false } };

type P = { params: Promise<{ lang: string }>; searchParams: Promise<{ key?: string }> };

const STATUS_KO: Record<string, string> = { public: "공개", pending: "대기", private: "본인만", withdrawn: "본인이 내림", hidden: "숨김", removed: "내림" };

function Stat({ label, v, sub }: { label: string; v: number | string; sub?: string }) {
    return (
        <div className="rounded-2xl bg-card px-3 py-2.5">
            <p className="text-[11px] text-dim">{label}</p>
            <p className="text-xl font-semibold text-ink">{v}</p>
            {sub && <p className="text-[11px] text-muted">{sub}</p>}
        </div>
    );
}

function StoryRow({ s, adminKey }: { s: AdminStory; adminKey: string }) {
    const when = formatDate(s.at, "ko", { dateStyle: "short", timeStyle: "short" });
    return (
        <li className="rounded-2xl bg-card px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-dim">
                <span className="text-muted">#{s.id}</span>
                <span className="text-star-soft">{s.room}</span>
                <span>{s.lang}</span>
                {s.country && <span>{flagEmoji(s.country)}</span>}
                <span>{s.nickname ?? "익명"}</span>
                <span>{when}</span>
                <span className={s.status === "public" ? "text-muted" : "text-rose"}>{STATUS_KO[s.status] ?? s.status}{s.note ? ` (${s.note})` : ""}</span>
                <span>공감 {s.empathy}</span>
                {s.reports > 0 && <span className="text-rose">신고 {s.reports}</span>}
            </div>
            <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink">{s.body.length > 300 ? s.body.slice(0, 300) + "…" : s.body}</p>
            <div className="mt-2">
                <AdminActions id={s.id} status={s.status} adminKey={adminKey} />
            </div>
        </li>
    );
}

export default async function AdminPage({ params, searchParams }: P) {
    await requireLang(params);
    const { key } = await searchParams;
    if (!(await isAdmin(key))) return <AdminLogin />;
    const [st, plan] = await Promise.all([getAdminStats(), getSwapPlan()]);
    const maxDay = Math.max(1, ...st.visitors.days.map((d) => d.n));
    // 쿠키로 들어왔으면 키는 비워 둠 (각 API 가 쿠키로 확인)
    const adminKey = key ?? "";
    return (
        <div className="px-4 pb-16 pt-4">
            {key && <AdminRemember adminKey={key} />}
            <h1 className="text-xl font-semibold text-ink">관리</h1>
            <p className="mt-0.5 text-[11px] text-dim">{formatDate(new Date(), "ko", { dateStyle: "medium", timeStyle: "short" })} 기준 · 새로고침하면 갱신</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="열린 주제" v={`${st.rooms.length}개`} sub={`${TOPIC_SLOTS}칸 중 · 실시간 인원은 아래`} />
                <Stat label="오늘 방문자" v={st.visitors.today} sub={`7일 ${st.visitors.week} · 전체 ${st.visitors.total}`} />
                <Stat label="오늘 올라온 글" v={st.stories.today} sub={`7일 ${st.stories.week} · 공개 전체 ${st.stories.total}`} />
                <Stat label="오늘 공감" v={st.empathies.today} sub={`7일 ${st.empathies.week} · 전체 ${st.empathies.total}`} />
            </div>
            {(st.stories.pending > 0 || st.stories.privateN > 0 || st.stories.hidden > 0) && (
                <p className="mt-2 text-[11px] text-muted">공개 아닌 글: 대기 {st.stories.pending} · 본인만 {st.stories.privateN} · 숨김 {st.stories.hidden}</p>
            )}

            <h2 className="mt-6 text-sm font-semibold text-ink">실시간 언덕</h2>
            <AdminLive adminKey={adminKey} />

            <h2 className="mt-6 text-sm font-semibold text-ink">최근 14일 방문자</h2>
            <div className="mt-2 flex h-24 items-end gap-1">
                {st.visitors.days.map((d) => (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                        <span className="text-[10px] text-muted">{d.n || ""}</span>
                        <div className="w-full rounded-t bg-star/70" style={{ height: `${Math.max(2, (d.n / maxDay) * 64)}px` }} />
                        <span className="text-[9px] text-dim">{d.day.slice(8)}</span>
                    </div>
                ))}
            </div>

            <h2 className="mt-6 text-sm font-semibold text-ink">방별</h2>
            <table className="mt-2 w-full text-[12px]">
                <thead className="text-left text-[11px] text-dim">
                    <tr><th className="py-1 font-normal">방</th><th className="py-1 text-right font-normal">글</th><th className="py-1 text-right font-normal">공감</th><th className="py-1 text-right font-normal">마지막 글</th></tr>
                </thead>
                <tbody>
                    {st.rooms.map((r) => (
                        <tr key={r.slug} className="border-t border-line">
                            <td className="py-1.5 text-ink">{r.title}{r.featured && <span className="ml-1 text-[10px] text-star">이번 달</span>}</td>
                            <td className="py-1.5 text-right text-ink">{r.stories}</td>
                            <td className="py-1.5 text-right text-muted">{r.empathy}</td>
                            <td className="py-1.5 text-right text-dim">{r.last ? formatDate(r.last, "ko", { month: "numeric", day: "numeric" }) : "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {st.reported.length > 0 && (
                <>
                    <h2 className="mt-6 text-sm font-semibold text-rose">신고된 글 {st.reported.length}</h2>
                    <ul className="mt-2 space-y-2">{st.reported.map((s) => <StoryRow key={s.id} s={s} adminKey={adminKey} />)}</ul>
                </>
            )}

            <h2 className="mt-6 text-sm font-semibold text-ink">최근 글 {st.recent.length}</h2>
            {st.recent.length === 0 && <p className="mt-2 text-[12px] text-dim">아직 글이 없어요</p>}
            <ul className="mt-2 space-y-2">{st.recent.map((s) => <StoryRow key={s.id} s={s} adminKey={adminKey} />)}</ul>

            <h2 className="mt-6 text-sm font-semibold text-ink">이번 달 주제 교체</h2>
            <TopicSwap plan={plan} slots={TOPIC_SLOTS} adminKey={adminKey} />

            <h2 className="mt-6 text-sm font-semibold text-ink">소원 부두 (최근 60개)</h2>
            <AdminWishes adminKey={adminKey} />

            <h2 className="mt-6 text-sm font-semibold text-ink">후원 내역 (카카오페이 받은 것 직접 입력)</h2>
            <AdminDonations adminKey={adminKey} />

            <h2 className="mt-6 text-sm font-semibold text-ink">제안된 주제 {st.proposals.length}</h2>
            {st.proposals.length === 0 && <p className="mt-2 text-[12px] text-dim">아직 없어요</p>}
            <ul className="mt-2 space-y-1 text-[12px]">
                {st.proposals.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
                        <span className="text-ink">{p.title} <span className="text-[10px] text-dim">{p.lang}</span></span>
                        <span className="text-muted">공감 {p.empathy}{p.status === "promoted" ? " · 주제 됨" : ""}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
