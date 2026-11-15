// 관리자 페이지: 키 확인 + 통계 집계. 키는 STAR_ADMIN_KEY (없으면 페이지 자체가 404)
import { timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { getPresence } from "./hill";
import { kstDay, kstDayStart, lastDays } from "./kst";
import { pickI18n } from "./rooms";

export function adminKeyOk(key: string | null | undefined): boolean {
    const want = process.env.STAR_ADMIN_KEY || "";
    if (!want || !key || key.length !== want.length) return false;
    return timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

export type AdminStory = { id: number; room: string; lang: string; nickname: string | null; body: string; status: string; empathy: number; reports: number; country: string | null; at: Date; note: string | null };
export type AdminStats = {
    online: number;
    visitors: { today: number; week: number; total: number; days: { day: string; n: number }[] };
    stories: { today: number; week: number; total: number; pending: number; privateN: number; hidden: number };
    empathies: { today: number; week: number; total: number };
    rooms: { slug: string; title: string; featured: boolean; stories: number; empathy: number; last: Date | null }[];
    recent: AdminStory[];
    reported: AdminStory[];
    proposals: { id: number; title: string; lang: string; empathy: number; status: string; at: Date }[];
};

const toRow = (s: { id: number; lang: string; nickname: string | null; body: string; status: string; empathy_count: number; report_count: number; country: string | null; created_at: Date; moderation_note: string | null; room: { i18n: { lang: string; title: string; description: string }[] } }): AdminStory => ({
    id: s.id, room: pickI18n(s.room.i18n, "ko").title, lang: s.lang, nickname: s.nickname, body: s.body, status: s.status, empathy: s.empathy_count, reports: s.report_count, country: s.country, at: s.created_at, note: s.moderation_note,
});

export async function getAdminStats(): Promise<AdminStats> {
    const days14 = lastDays(14);
    const today = kstDay();
    const todayStart = kstDayStart(today);
    const weekStart = kstDayStart(days14[7]);
    const sel = { id: true, lang: true, nickname: true, body: true, status: true, empathy_count: true, report_count: true, country: true, created_at: true, moderation_note: true, room: { select: { i18n: true } } } as const;

    const [presence, visitDays, visitTotal, stTotal, stToday, stWeek, stPending, stPrivate, stHidden, emTotal, emToday, emWeek, rooms, recent, reported, proposals] = await Promise.all([
        getPresence(),
        prisma.visit_day.groupBy({ by: ["day"], where: { day: { gte: days14[0] } }, _count: { _all: true } }),
        prisma.visit_day.findMany({ distinct: ["voter_key"], select: { voter_key: true } }).then((r) => r.length),
        prisma.story.count({ where: { status: "public" } }),
        prisma.story.count({ where: { status: "public", created_at: { gte: todayStart } } }),
        prisma.story.count({ where: { status: "public", created_at: { gte: weekStart } } }),
        prisma.story.count({ where: { status: "pending" } }),
        prisma.story.count({ where: { status: "private" } }),
        prisma.story.count({ where: { status: "hidden" } }),
        prisma.empathy.count(),
        prisma.empathy.count({ where: { created_at: { gte: todayStart } } }),
        prisma.empathy.count({ where: { created_at: { gte: weekStart } } }),
        prisma.room.findMany({ where: { status: "open" }, orderBy: { sort_order: "asc" }, include: { i18n: true } }),
        prisma.story.findMany({ where: { status: { not: "removed" } }, orderBy: { created_at: "desc" }, take: 30, select: sel }),
        prisma.story.findMany({ where: { report_count: { gt: 0 }, status: { in: ["public", "hidden"] } }, orderBy: { report_count: "desc" }, take: 30, select: sel }),
        prisma.room_proposal.findMany({ where: { status: { in: ["open", "promoted"] } }, orderBy: [{ status: "asc" }, { empathy_count: "desc" }], take: 30 }),
    ]);

    const byDay = new Map(visitDays.map((v) => [v.day, v._count._all]));
    const dayRows = days14.map((d) => ({ day: d, n: byDay.get(d) ?? 0 }));
    const roomRows = await Promise.all(
        rooms.map(async (r) => {
            const agg = await prisma.story.aggregate({ where: { room_id: r.id, status: "public" }, _count: { _all: true }, _sum: { empathy_count: true }, _max: { published_at: true } });
            return { slug: r.slug, title: pickI18n(r.i18n, "ko").title, featured: !!r.featured_until && r.featured_until > new Date(), stories: agg._count._all, empathy: agg._sum.empathy_count ?? 0, last: agg._max.published_at };
        })
    );

    return {
        online: presence.total,
        visitors: { today: byDay.get(today) ?? 0, week: dayRows.slice(7).reduce((a, b) => a + b.n, 0), total: visitTotal, days: dayRows },
        stories: { today: stToday, week: stWeek, total: stTotal, pending: stPending, privateN: stPrivate, hidden: stHidden },
        empathies: { today: emToday, week: emWeek, total: emTotal },
        rooms: roomRows,
        recent: recent.map(toRow),
        reported: reported.map(toRow),
        proposals: proposals.map((p) => ({ id: p.id, title: p.title, lang: p.lang, empathy: p.empathy_count, status: p.status, at: p.created_at })),
    };
}

export type AdminAction = "hide" | "unhide" | "remove";

// 운영자 조치. hide = 본인에게만 보임, unhide = 다시 공개, remove = 완전 내림(목록에서 사라짐)
export async function adminStoryAction(id: number, action: AdminAction): Promise<boolean> {
    const row = await prisma.story.findUnique({ where: { id }, select: { status: true } });
    if (!row || row.status === "removed") return false;
    const data = action === "hide" ? { status: "hidden", moderation_note: "admin" } : action === "unhide" ? { status: "public", moderation_note: null } : { status: "removed", moderation_note: "admin" };
    await prisma.story.update({ where: { id }, data });
    const { memoClear } = await import("./cache");
    memoClear();
    return true;
}
