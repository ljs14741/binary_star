import { prisma } from "./prisma";
import type { Lang } from "./i18n/config";
import { LANGS } from "./i18n/config";
import { hasBannedWord, hasUrl } from "./moderation";
import { DAILY_PROPOSAL_LIMIT, PROPOSAL_MAX_LEN, PROPOSAL_THRESHOLD } from "./site";
import { aiEnabled, aiTranslate } from "./ai";
import type { Geo } from "./geo";

export type ProposalView = {
    id: number;
    title: string;
    lang: string;
    empathyCount: number;
    status: string;
    roomSlug: string | null;
    empathized: boolean;
    mine: boolean;
    createdAt: string;
};

export async function listProposals(voterKey?: string): Promise<ProposalView[]> {
    const rows = await prisma.room_proposal.findMany({
        where: { status: { in: ["open", "promoted"] } },
        orderBy: [{ empathy_count: "desc" }, { created_at: "desc" }],
        take: 100,
    });
    const ids = rows.map((r) => r.id);
    const [mine, rooms] = await Promise.all([
        voterKey && ids.length ? prisma.proposal_empathy.findMany({ where: { proposal_id: { in: ids }, voter_key: voterKey }, select: { proposal_id: true } }) : Promise.resolve([]),
        prisma.room.findMany({ where: { id: { in: rows.map((r) => r.room_id).filter((x): x is number => !!x) } }, select: { id: true, slug: true } }),
    ]);
    const mineSet = new Set(mine.map((m) => m.proposal_id));
    const roomMap = new Map(rooms.map((r) => [r.id, r.slug]));
    return rows.map((r) => ({
        id: r.id,
        title: r.title,
        lang: r.lang,
        empathyCount: r.empathy_count,
        status: r.status,
        roomSlug: r.room_id ? roomMap.get(r.room_id) ?? null : null,
        empathized: mineSet.has(r.id),
        mine: r.voter_key === voterKey,
        createdAt: r.created_at.toISOString(),
    }));
}

export type CreateProposalResult = { ok: true; proposal: ProposalView } | { ok: false; error: "empty" | "too_long" | "banned" | "limit" | "dup" };

export async function createProposal(title: string, lang: Lang, voterKey: string, geo: Geo): Promise<CreateProposalResult> {
    const t = title.replace(/\s+/g, " ").trim();
    if (!t) return { ok: false, error: "empty" };
    if (t.length > PROPOSAL_MAX_LEN) return { ok: false, error: "too_long" };
    if (hasBannedWord(t) || hasUrl(t)) return { ok: false, error: "banned" };
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const today = await prisma.room_proposal.count({ where: { voter_key: voterKey, created_at: { gte: since } } });
    if (today >= DAILY_PROPOSAL_LIMIT) return { ok: false, error: "limit" };
    const dup = await prisma.room_proposal.findFirst({ where: { title: t, status: { in: ["open", "promoted"] } } });
    if (dup) return { ok: false, error: "dup" };
    const row = await prisma.room_proposal.create({ data: { title: t, lang, voter_key: voterKey, country: geo.country } });
    return {
        ok: true,
        proposal: { id: row.id, title: row.title, lang: row.lang, empathyCount: 0, status: row.status, roomSlug: null, empathized: false, mine: true, createdAt: row.created_at.toISOString() },
    };
}

export type ProposalEmpathyResult = { ok: true; empathized: boolean; count: number; promotedSlug: string | null } | { ok: false; error: "not_found" | "closed" };

export async function toggleProposalEmpathy(id: number, voterKey: string): Promise<ProposalEmpathyResult> {
    const p = await prisma.room_proposal.findUnique({ where: { id } });
    if (!p) return { ok: false, error: "not_found" };
    if (p.status !== "open") return { ok: false, error: "closed" };
    const existing = await prisma.proposal_empathy.findUnique({ where: { proposal_id_voter_key: { proposal_id: id, voter_key: voterKey } } });
    if (existing) {
        const [, u] = await prisma.$transaction([
            prisma.proposal_empathy.delete({ where: { id: existing.id } }),
            prisma.room_proposal.update({ where: { id }, data: { empathy_count: { decrement: 1 } } }),
        ]);
        return { ok: true, empathized: false, count: Math.max(0, u.empathy_count), promotedSlug: null };
    }
    let count = p.empathy_count;
    try {
        const [, u] = await prisma.$transaction([
            prisma.proposal_empathy.create({ data: { proposal_id: id, voter_key: voterKey } }),
            prisma.room_proposal.update({ where: { id }, data: { empathy_count: { increment: 1 } } }),
        ]);
        count = u.empathy_count;
    } catch {
        return { ok: true, empathized: true, count, promotedSlug: null };
    }
    let promotedSlug: string | null = null;
    if (count >= PROPOSAL_THRESHOLD && p.auto_approve) {
        promotedSlug = await promoteProposal(id);
    }
    return { ok: true, empathized: true, count, promotedSlug };
}

function slugify(title: string, id: number): string {
    const ascii = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);
    return ascii ? `p${id}-${ascii}` : `p${id}`;
}

// 제안 → 정식 방. 방 이름은 4개 언어에 넣되 키 있으면 번역, 없으면 원문 그대로
export async function promoteProposal(id: number): Promise<string | null> {
    const p = await prisma.room_proposal.findUnique({ where: { id } });
    if (!p || p.status === "promoted") return null;
    const slug = slugify(p.title, p.id);
    const from = (LANGS as readonly string[]).includes(p.lang) ? (p.lang as Lang) : "en";
    const titles: Record<string, string> = {};
    for (const l of LANGS) {
        titles[l] = p.title;
        if (l !== from && aiEnabled()) {
            const tr = await aiTranslate(p.title, from, l);
            if (tr) titles[l] = tr;
        }
    }
    const maxOrder = await prisma.room.aggregate({ _max: { sort_order: true } });
    const room = await prisma.room.create({
        data: {
            slug,
            sort_order: (maxOrder._max.sort_order ?? 0) + 1,
            i18n: { create: LANGS.map((l) => ({ lang: l, title: titles[l], description: "" })) },
        },
    });
    await prisma.room_proposal.update({ where: { id }, data: { status: "promoted", room_id: room.id } });
    return room.slug;
}
