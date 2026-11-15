// 소원 부두: 달에게 비는 한 줄 소원. 익명, 그날 밤(한국 날짜)만 하늘에 풍등으로 뜸
import { prisma } from "./prisma";
import { moderate } from "./moderation";
import { kstDay } from "./kst";
import { memo, memoClear } from "./cache";
import type { Lang } from "./i18n/config";

export const WISH_MAX_LEN = 60;
export const WISH_PER_DAY = 3; // 한 사람(쿠키+IP)이 하루에 빌 수 있는 수
export const WISH_PER_IP_DAY = 12; // 같은 IP 대역 하루 (쿠키를 지워도)
export const WISH_HIDE_REPORTS = 3; // 서로 다른 IP 대역 신고 수

export type WishView = { id: number; body: string; cheers: number; cheered: boolean; mine: boolean };

export type CreateWishResult = { ok: true; wish: WishView; crisis: boolean } | { ok: false; error: "empty" | "too_long" | "url" | "banned" | "limit" };

export async function createWish(input: { body: string; lang: Lang; voterKey: string; ipHash: string }): Promise<CreateWishResult> {
    const day = kstDay();
    const m = moderate((input.body ?? "").replace(/\s*\n\s*/g, " "), WISH_MAX_LEN);
    if (!m.ok) return { ok: false, error: m.reason as "empty" | "too_long" | "url" | "banned" };
    const [mine, fromIp] = await Promise.all([
        prisma.wish.count({ where: { voter_key: input.voterKey, kst_day: day } }),
        prisma.wish.count({ where: { ip_hash: input.ipHash, kst_day: day } }),
    ]);
    if (mine >= WISH_PER_DAY || fromIp >= WISH_PER_IP_DAY) return { ok: false, error: "limit" };
    // 위기 낱말이 있으면 하늘엔 안 띄우고(본인 화면에만 풍등), 상담 안내를 보여 줌
    const row = await prisma.wish.create({ data: { body: m.body, lang: input.lang, voter_key: input.voterKey, ip_hash: input.ipHash, kst_day: day, status: m.crisis ? "private" : "public" } });
    memoClear("wishes:");
    return { ok: true, wish: { id: row.id, body: row.body, cheers: 0, cheered: false, mine: true }, crisis: m.crisis };
}

// 오늘 밤 하늘의 소원 (최근 것부터 30개) + 오늘 밤 소원 수
export async function listTonight(voterKey?: string): Promise<{ count: number; items: WishView[] }> {
    const day = kstDay();
    const base = await memo(`wishes:tonight:${day}`, 15_000, async () => {
        const [count, rows] = await Promise.all([
            prisma.wish.count({ where: { kst_day: day, status: { in: ["public", "private"] } } }),
            prisma.wish.findMany({ where: { kst_day: day, status: "public" }, orderBy: { id: "desc" }, take: 100, select: { id: true, body: true, cheer_count: true, voter_key: true } }),
        ]);
        return { count, rows };
    });
    const ids = base.rows.map((r) => r.id);
    const cheered = voterKey && ids.length ? new Set((await prisma.wish_cheer.findMany({ where: { wish_id: { in: ids }, voter_key: voterKey }, select: { wish_id: true } })).map((c) => c.wish_id)) : new Set<number>();
    return { count: base.count, items: base.rows.map((r) => ({ id: r.id, body: r.body, cheers: r.cheer_count, cheered: cheered.has(r.id), mine: !!voterKey && r.voter_key === voterKey })) };
}

// 빌어 줄게: 한 사람당 한 번 (취소 없음, 가벼운 응원)
export async function cheerWish(id: number, voterKey: string): Promise<{ ok: true; cheers: number } | { ok: false; error: "not_found" | "own" | "dup" }> {
    const w = await prisma.wish.findFirst({ where: { id, status: "public" }, select: { voter_key: true } });
    if (!w) return { ok: false, error: "not_found" };
    if (w.voter_key === voterKey) return { ok: false, error: "own" };
    try {
        const [, u] = await prisma.$transaction([prisma.wish_cheer.create({ data: { wish_id: id, voter_key: voterKey } }), prisma.wish.update({ where: { id }, data: { cheer_count: { increment: 1 } } })]);
        memoClear("wishes:");
        return { ok: true, cheers: u.cheer_count };
    } catch {
        return { ok: false, error: "dup" };
    }
}

// 신고: 서로 다른 IP 대역 3곳이면 하늘에서 내림
export async function reportWish(id: number, ipHash: string): Promise<{ ok: true; hidden: boolean } | { ok: false; error: "not_found" | "dup" }> {
    const w = await prisma.wish.findFirst({ where: { id, status: { in: ["public", "hidden"] } }, select: { id: true } });
    if (!w) return { ok: false, error: "not_found" };
    try {
        await prisma.wish_report.create({ data: { wish_id: id, ip_hash: ipHash } });
    } catch {
        return { ok: false, error: "dup" };
    }
    const n = await prisma.wish_report.count({ where: { wish_id: id } });
    const hide = n >= WISH_HIDE_REPORTS;
    await prisma.wish.update({ where: { id }, data: { report_count: n, ...(hide ? { status: "hidden" } : {}) } });
    memoClear("wishes:");
    return { ok: true, hidden: hide };
}

// 관리자: 최근 소원 (숨긴 것 포함)
export type AdminWish = { id: number; body: string; day: string; status: string; cheers: number; reports: number; at: Date };
export async function listAdminWishes(): Promise<AdminWish[]> {
    const rows = await prisma.wish.findMany({ orderBy: { id: "desc" }, take: 60 });
    return rows.map((r) => ({ id: r.id, body: r.body, day: r.kst_day, status: r.status, cheers: r.cheer_count, reports: r.report_count, at: r.created_at }));
}
export async function adminWishAction(id: number, action: "hide" | "unhide" | "remove"): Promise<boolean> {
    if (action === "remove") {
        const r = await prisma.wish.deleteMany({ where: { id } });
        memoClear("wishes:");
        return r.count > 0;
    }
    const r = await prisma.wish.updateMany({ where: { id }, data: { status: action === "hide" ? "hidden" : "public" } });
    memoClear("wishes:");
    return r.count > 0;
}
