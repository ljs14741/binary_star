// 방명록: 사이트에 남기는 한마디. 공개, 별명으로 표시, 운영자 답글
import { prisma } from "./prisma";
import { moderate } from "./moderation";
import { checkNickname } from "./nickname";
import { kstDay } from "./kst";
import type { Lang } from "./i18n/config";
import { GUESTBOOK_MAX_LEN } from "./guestbook-shared";

export { GUESTBOOK_MAX_LEN };
export const GUESTBOOK_PER_DAY = 5; // 한 사람(쿠키+IP) 하루
export const GUESTBOOK_PER_IP_DAY = 20; // 같은 IP 대역 하루 (쿠키를 지워도)
export const GUESTBOOK_HIDE_REPORTS = 3; // 서로 다른 IP 대역 신고 수
export const GUESTBOOK_PAGE = 30;

export type GuestbookEntry = { id: number; nickname: string | null; body: string; lang: string; country: string | null; at: string; reply: string | null; replyAt: string | null; mine: boolean };

type Row = { id: number; nickname: string | null; body: string; lang: string; country: string | null; created_at: Date; reply: string | null; reply_at: Date | null; voter_key: string };
const toEntry = (r: Row, voterKey?: string): GuestbookEntry => ({
    id: r.id,
    nickname: r.nickname,
    body: r.body,
    lang: r.lang,
    country: r.country,
    at: r.created_at.toISOString(),
    reply: r.reply,
    replyAt: r.reply_at?.toISOString() ?? null,
    mine: !!voterKey && r.voter_key === voterKey,
});

export type CreateGuestbookResult = { ok: true; entry: GuestbookEntry; crisis: boolean } | { ok: false; error: "empty" | "too_long" | "url" | "banned" | "limit" | "nickname" };

export async function createGuestbook(input: { body: string; nickname?: string | null; lang: Lang; country: string | null; voterKey: string; ipHash: string }): Promise<CreateGuestbookResult> {
    const day = kstDay();
    const m = moderate(input.body ?? "", GUESTBOOK_MAX_LEN);
    if (!m.ok) return { ok: false, error: m.reason as "empty" | "too_long" | "url" | "banned" };
    const nick = checkNickname(input.nickname);
    if (!nick.ok) return { ok: false, error: "nickname" };
    const [mine, fromIp] = await Promise.all([prisma.guestbook.count({ where: { voter_key: input.voterKey, kst_day: day } }), prisma.guestbook.count({ where: { ip_hash: input.ipHash, kst_day: day } })]);
    if (mine >= GUESTBOOK_PER_DAY || fromIp >= GUESTBOOK_PER_IP_DAY) return { ok: false, error: "limit" };
    // 위기 낱말이면 공개 안 하고(본인 화면에만) 상담 안내
    const row = await prisma.guestbook.create({
        data: { nickname: nick.value, body: m.body, lang: input.lang, country: input.country, voter_key: input.voterKey, ip_hash: input.ipHash, kst_day: day, status: m.crisis ? "private" : "public" },
    });
    return { ok: true, entry: toEntry(row, input.voterKey), crisis: m.crisis };
}

// 최신순. before = 이 id 보다 오래된 것 (더 보기)
export async function listGuestbook(opts: { before?: number | null; voterKey?: string } = {}): Promise<{ items: GuestbookEntry[]; more: boolean }> {
    const rows = await prisma.guestbook.findMany({
        where: { status: "public", ...(opts.before ? { id: { lt: opts.before } } : {}) },
        orderBy: { id: "desc" },
        take: GUESTBOOK_PAGE + 1,
    });
    return { items: rows.slice(0, GUESTBOOK_PAGE).map((r) => toEntry(r, opts.voterKey)), more: rows.length > GUESTBOOK_PAGE };
}

// 신고: 서로 다른 IP 대역 3곳이면 숨김
export async function reportGuestbook(id: number, ipHash: string): Promise<{ ok: true; hidden: boolean } | { ok: false; error: "not_found" | "dup" }> {
    const e = await prisma.guestbook.findFirst({ where: { id, status: { in: ["public", "hidden"] } }, select: { id: true } });
    if (!e) return { ok: false, error: "not_found" };
    try {
        await prisma.guestbook_report.create({ data: { guestbook_id: id, ip_hash: ipHash } });
    } catch {
        return { ok: false, error: "dup" };
    }
    const n = await prisma.guestbook_report.count({ where: { guestbook_id: id } });
    const hide = n >= GUESTBOOK_HIDE_REPORTS;
    await prisma.guestbook.update({ where: { id }, data: { report_count: n, ...(hide ? { status: "hidden" } : {}) } });
    return { ok: true, hidden: hide };
}

// 관리자: 최근 방명록 (숨긴 것·위기 낱말 포함)
export type AdminGuestbook = { id: number; nickname: string | null; body: string; lang: string; country: string | null; status: string; reports: number; reply: string | null; at: Date };
export async function listAdminGuestbook(): Promise<AdminGuestbook[]> {
    const rows = await prisma.guestbook.findMany({ orderBy: { id: "desc" }, take: 60 });
    return rows.map((r) => ({ id: r.id, nickname: r.nickname, body: r.body, lang: r.lang, country: r.country, status: r.status, reports: r.report_count, reply: r.reply, at: r.created_at }));
}

export type AdminGuestbookAction = "hide" | "unhide" | "remove" | "reply";
export async function adminGuestbookAction(id: number, action: AdminGuestbookAction, reply?: string | null): Promise<boolean> {
    if (action === "remove") return (await prisma.guestbook.deleteMany({ where: { id } })).count > 0;
    if (action === "reply") {
        // 빈 답글이면 답글 지움
        const text = (reply ?? "").trim().slice(0, GUESTBOOK_MAX_LEN * 2);
        return (await prisma.guestbook.updateMany({ where: { id }, data: { reply: text || null, reply_at: text ? new Date() : null } })).count > 0;
    }
    return (await prisma.guestbook.updateMany({ where: { id }, data: { status: action === "hide" ? "hidden" : "public" } })).count > 0;
}
