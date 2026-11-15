import type { story as StoryRow } from "@prisma/client";
import { emitStar } from "./realtime/emit";
import { prisma } from "./prisma";
import { isLang, type Lang } from "./i18n/config";
import { moderate, hasBannedWord, hasUrl, maskPii } from "./moderation";
import { memoClear } from "./cache";
import { aiEnabled, aiModerate } from "./ai";
import { getCachedTranslations } from "./translate";
import { hashOwnerToken, newOwnerToken } from "./crypto";
import type { Geo } from "./geo";
import { rateLimit } from "./ratelimit";
import { AGE_GROUPS, DAILY_STORY_LIMIT, EDIT_WINDOW_MS, EMPATHY_PER_IP_PER_MINUTE, EMPATHY_PER_IP_PER_STORY_DAY, EMPATHY_PER_MINUTE, NICKNAME_MAX_LEN, REPORT_HIDE_COUNT, RISING_MIN } from "./site";
import { pickI18n } from "./rooms";

export type StoryView = {
    id: number;
    body: string;
    nickname: string | null;
    lang: Lang;
    ageGroup: string | null;
    country: string | null;
    city: string | null;
    status: string;
    empathyCount: number;
    countryCount: number;
    rising24h: number;
    isSeed: boolean;
    createdAt: string;
    editedAt: string | null;
    canEdit: boolean; // 주인이고 10분 안
    roomSlug: string;
    roomTitle: string;
    // 읽는 사람 언어 번역본 (캐시에 있을 때만 채움. 없으면 클라이언트가 /translation 호출)
    translation: { body: string; from: Lang; pending: boolean } | null;
    empathized: boolean;
    mine: boolean;
    moderationNote: string | null;
};

// DB 행 → 화면용. 공감 나라 수·24시간 증가·번역·내 공감 여부를 한 번에 붙임
export async function toStoryViews(rows: StoryRow[], lang: Lang, voterKey?: string, ownerTokenHash?: string): Promise<StoryView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [countryRows, risingRows, translations, myEmpathies, rooms] = await Promise.all([
        prisma.empathy.groupBy({ by: ["story_id", "country"], where: { story_id: { in: ids } } }),
        prisma.empathy.groupBy({ by: ["story_id"], where: { story_id: { in: ids }, created_at: { gte: since } }, _count: { _all: true } }),
        getCachedTranslations(ids, lang),
        voterKey ? prisma.empathy.findMany({ where: { story_id: { in: ids }, voter_key: voterKey }, select: { story_id: true } }) : Promise.resolve([]),
        prisma.room.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.room_id))] } }, include: { i18n: true } }),
    ]);
    const countryCount = new Map<number, number>();
    for (const c of countryRows) if (c.country) countryCount.set(c.story_id, (countryCount.get(c.story_id) ?? 0) + 1);
    const rising = new Map(risingRows.map((r) => [r.story_id, r._count._all]));
    const mySet = new Set(myEmpathies.map((e) => e.story_id));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    return rows.map((r) => {
        const room = roomMap.get(r.room_id);
        const t = room ? pickI18n(room.i18n, lang) : undefined;
        const from: Lang = isLang(r.lang) ? r.lang : "en";
        const cached = translations.get(r.id);
        const translation = from === lang ? null : cached ? { body: cached, from, pending: false } : null;
        const isOwner = (!!voterKey && r.voter_key === voterKey) || (!!ownerTokenHash && r.owner_token_hash === ownerTokenHash);
        return {
            id: r.id,
            body: r.body,
            nickname: r.nickname,
            lang: from,
            ageGroup: r.age_group,
            country: r.country,
            city: r.city,
            status: r.status,
            empathyCount: r.empathy_count,
            countryCount: countryCount.get(r.id) ?? 0,
            rising24h: rising.get(r.id) ?? 0,
            isSeed: r.is_seed,
            createdAt: r.created_at.toISOString(),
            editedAt: r.edited_at ? r.edited_at.toISOString() : null,
            canEdit: !!ownerTokenHash && r.owner_token_hash === ownerTokenHash && Date.now() - r.created_at.getTime() < EDIT_WINDOW_MS,
            roomSlug: room?.slug ?? "",
            roomTitle: t?.title ?? "",
            translation,
            empathized: mySet.has(r.id),
            mine: isOwner,
            moderationNote: r.moderation_note,
        };
    });
}

export function isRising(v: StoryView): boolean {
    return v.rising24h >= RISING_MIN;
}

// ---------- 피드 ----------
export type FeedParams = {
    roomSlug?: string;
    lang: Lang;
    firstId?: number; // 공유 링크로 왔으면 이 이야기 먼저
    exclude?: number[]; // 이번 세션에 이미 보여 준 것 (절대 다시 안 줌)
    seen?: number[]; // 예전에 본 것 (덜 보이게)
    limit?: number;
    voterKey?: string;
    ownerTokenHash?: string;
};

function shuffleWeighted<T>(items: T[], weight: (t: T) => number): T[] {
    // 가중치 큰 게 앞에 오기 쉬운 셔플
    return items
        .map((it) => ({ it, k: Math.pow(Math.random(), 1 / Math.max(weight(it), 0.1)) }))
        .sort((a, b) => b.k - a.k)
        .map((x) => x.it);
}

export async function getFeed(p: FeedParams): Promise<{ stories: StoryView[]; hasMore: boolean }> {
    const limit = Math.min(Math.max(p.limit ?? 8, 1), 20);
    const exclude = new Set(p.exclude ?? []);
    const seen = new Set((p.seen ?? []).filter((id) => !exclude.has(id)));
    const room = p.roomSlug ? await prisma.room.findUnique({ where: { slug: p.roomSlug }, select: { id: true } }) : null;
    if (p.roomSlug && !room) return { stories: [], hasMore: false };

    const out: StoryRow[] = [];
    if (p.firstId && !exclude.has(p.firstId)) {
        const first = await prisma.story.findFirst({ where: { id: p.firstId, status: "public", ...(room ? { room_id: room.id } : {}) } });
        if (first) {
            out.push(first);
            exclude.add(first.id);
        }
    }

    const base = (extra: Record<string, unknown> = {}) => ({
        status: "public",
        ...(room ? { room_id: room.id } : {}),
        id: { notIn: [...exclude, ...seen] },
        ...extra,
    });
    // 번역이 안 되면(키 없음) 읽는 사람 언어 글만. 되면 다른 언어 글을 6개 중 1개꼴로 섞음
    const translate = aiEnabled();
    const langFilter = translate ? {} : { lang: p.lang };
    const [popular, fresh, foreign] = await Promise.all([
        prisma.story.findMany({ where: base(langFilter), orderBy: [{ empathy_count: "desc" }, { published_at: "desc" }], take: 30 }),
        prisma.story.findMany({ where: base(langFilter), orderBy: { published_at: "desc" }, take: 15 }),
        translate ? prisma.story.findMany({ where: base({ lang: { not: p.lang } }), orderBy: [{ empathy_count: "desc" }], take: 10 }) : Promise.resolve([] as StoryRow[]),
    ]);

    const used = new Set<number>(exclude);
    const take = (arr: StoryRow[]) => {
        const r = arr.find((s) => !used.has(s.id));
        if (r) used.add(r.id);
        return r;
    };
    const pop = shuffleWeighted(popular, (s) => s.empathy_count + 1);
    const fre = [...fresh];
    const frn = shuffleWeighted(foreign, (s) => s.empathy_count + 1);
    // 인기 3 · 새 글 2 · 다른 언어 1 순서로 섞음
    while (out.length < limit) {
        const picks = [take(pop), take(pop), take(fre), take(pop), take(fre), take(frn)].filter((s): s is StoryRow => !!s);
        if (picks.length === 0) break;
        for (const s of picks) if (out.length < limit) out.push(s);
    }
    // 새 것만으로 모자라면 예전에 본 것도 다시 보여 줌
    if (out.length < limit && seen.size > 0) {
        const again = await prisma.story.findMany({
            where: { status: "public", ...(room ? { room_id: room.id } : {}), ...langFilter, id: { in: [...seen].filter((id) => !used.has(id)) } },
            orderBy: [{ empathy_count: "desc" }],
            take: limit - out.length,
        });
        for (const s of again) {
            used.add(s.id);
            out.push(s);
        }
    }
    const remaining = await prisma.story.count({ where: { status: "public", ...(room ? { room_id: room.id } : {}), ...langFilter, id: { notIn: [...used] } } });
    const stories = await toStoryViews(out, p.lang, p.voterKey, p.ownerTokenHash);
    return { stories, hasMore: remaining > 0 };
}

export async function getPublicStory(id: number, lang: Lang, voterKey?: string, ownerTokenHash?: string): Promise<StoryView | null> {
    const row = await prisma.story.findFirst({ where: { id, status: "public" } });
    if (!row) return null;
    return (await toStoryViews([row], lang, voterKey, ownerTokenHash))[0] ?? null;
}

// ---------- 작성 ----------
export type CreateInput = {
    roomSlug: string;
    body: string;
    nickname?: string | null;
    ageGroup?: string | null;
    lang: Lang;
    voterKey: string;
    ownerToken?: string | null; // 이미 있으면 같은 토큰으로 묶음
    geo: Geo;
    isSeed?: boolean;
};
export type CreateResult =
    | { ok: true; story: StoryView; ownerToken: string; masked: boolean; crisis: boolean }
    | { ok: false; error: "empty" | "too_long" | "url" | "banned" | "limit" | "room" | "rejected" | "nickname" };

// 별명 정리. 금칙어·링크·개인정보가 들어 있으면 null 대신 오류
export function cleanNickname(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
    const full = (raw ?? "").replace(/\s+/g, " ").trim();
    const v = full.slice(0, NICKNAME_MAX_LEN);
    if (!v) return { ok: true, value: null };
    // 전화번호·이메일·아이디 같은 건 별명에 못 넣음 (잘리기 전 원문 기준으로도 검사)
    if (hasBannedWord(v) || hasUrl(full) || maskPii(full).masked || /[@#<>]/.test(v) || /\d{4,}/.test(full)) return { ok: false };
    return { ok: true, value: v };
}

export async function createStory(input: CreateInput): Promise<CreateResult> {
    const room = await prisma.room.findUnique({ where: { slug: input.roomSlug }, select: { id: true, status: true } });
    if (!room || room.status !== "open") return { ok: false, error: "room" };

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const todayCount = await prisma.story.count({ where: { voter_key: input.voterKey, created_at: { gte: since } } });
    if (todayCount >= DAILY_STORY_LIMIT) return { ok: false, error: "limit" };

    const m = moderate(input.body);
    if (!m.ok) return { ok: false, error: m.reason! };
    const nick = cleanNickname(input.nickname);
    if (!nick.ok) return { ok: false, error: "nickname" };

    let status: "public" | "private" | "pending" = m.crisis ? "private" : "public";
    let note: string | null = m.crisis ? "crisis" : null;
    if (!m.crisis && aiEnabled()) {
        const v = await aiModerate(m.body);
        if (v?.verdict === "reject") return { ok: false, error: "rejected" };
        if (v?.verdict === "private") {
            status = "private";
            note = "ai_private";
        } else if (!v) note = "ai_skipped";
    }

    const ownerToken = input.ownerToken && input.ownerToken.length >= 32 ? input.ownerToken : newOwnerToken();
    const ageGroup = input.ageGroup && (AGE_GROUPS as readonly string[]).includes(input.ageGroup) ? input.ageGroup : null;
    const row = await prisma.story.create({
        data: {
            room_id: room.id,
            body: m.body,
            nickname: nick.value,
            lang: input.lang,
            age_group: ageGroup,
            country: input.geo.country,
            city: input.geo.city,
            status,
            moderation_note: note,
            owner_token_hash: hashOwnerToken(ownerToken),
            voter_key: input.voterKey,
            is_seed: !!input.isSeed,
            published_at: status === "public" ? new Date() : null,
        },
    });
    memoClear("rooms:");
    memoClear(`top:${room.id}`);
    memoClear("hill:");
    // 언덕 하늘에 새 별 (공개된 것만)
    if (status === "public") emitStar({ kind: "born", storyId: row.id, roomSlug: input.roomSlug, count: 0, lang: row.lang, voterKey: input.voterKey });
    const view = (await toStoryViews([row], input.lang, input.voterKey, hashOwnerToken(ownerToken)))[0];
    view.mine = true;
    return { ok: true, story: view, ownerToken, masked: m.masked, crisis: m.crisis };
}

// ---------- 공감 ----------
export type EmpathyResult = { ok: true; empathized: boolean; count: number } | { ok: false; error: "own" | "not_found" | "limit" };

export async function toggleEmpathy(storyId: number, voterKey: string, geo: Geo, ownerTokenHash?: string, ipHash?: string): Promise<EmpathyResult> {
    if (!rateLimit(`empathy:${voterKey}`, EMPATHY_PER_MINUTE, 60_000)) return { ok: false, error: "limit" };
    if (ipHash && !rateLimit(`empathy-ip:${ipHash}`, EMPATHY_PER_IP_PER_MINUTE, 60_000)) return { ok: false, error: "limit" };
    const story = await prisma.story.findFirst({ where: { id: storyId, status: "public" }, select: { id: true, voter_key: true, owner_token_hash: true, lang: true, room: { select: { slug: true } } } });
    if (!story) return { ok: false, error: "not_found" };
    if (story.voter_key === voterKey || (ownerTokenHash && story.owner_token_hash === ownerTokenHash)) return { ok: false, error: "own" };

    const existing = await prisma.empathy.findUnique({ where: { story_id_voter_key: { story_id: storyId, voter_key: voterKey } } });
    if (existing) {
        const [, updated] = await prisma.$transaction([
            prisma.empathy.delete({ where: { id: existing.id } }),
            prisma.story.update({ where: { id: storyId }, data: { empathy_count: { decrement: 1 } } }),
        ]);
        emitStar({ kind: "dim", storyId, roomSlug: story.room.slug, count: Math.max(0, updated.empathy_count), lang: story.lang, voterKey });
        return { ok: true, empathized: false, count: Math.max(0, updated.empathy_count) };
    }
    // 쿠키를 지우고 다시 눌러도 같은 IP 대역은 이야기당 하루 N 번까지만
    if (ipHash) {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const fromSameIp = await prisma.empathy.count({ where: { story_id: storyId, ip_hash: ipHash, created_at: { gte: since } } });
        if (fromSameIp >= EMPATHY_PER_IP_PER_STORY_DAY) return { ok: false, error: "limit" };
    }
    try {
        const [, updated] = await prisma.$transaction([
            prisma.empathy.create({ data: { story_id: storyId, voter_key: voterKey, country: geo.country, city: geo.city, lat: geo.lat, lng: geo.lng, ip_hash: ipHash ?? null } }),
            prisma.story.update({ where: { id: storyId }, data: { empathy_count: { increment: 1 } } }),
        ]);
        emitStar({ kind: "glow", storyId, roomSlug: story.room.slug, count: updated.empathy_count, lang: story.lang, voterKey });
        return { ok: true, empathized: true, count: updated.empathy_count };
    } catch {
        // 동시에 두 번 눌러 UNIQUE 에 걸린 경우
        const cur = await prisma.story.findUnique({ where: { id: storyId }, select: { empathy_count: true } });
        return { ok: true, empathized: true, count: cur?.empathy_count ?? 0 };
    }
}

// ---------- 신고 ----------
export type ReportResult = { ok: true; reportCount: number; hidden: boolean } | { ok: false; error: "dup" | "not_found" };
export const REPORT_REASONS = ["spam", "abuse", "pii", "other"] as const;

export async function reportStory(storyId: number, voterKey: string, reason: string): Promise<ReportResult> {
    const story = await prisma.story.findFirst({ where: { id: storyId, status: { in: ["public", "hidden"] } }, select: { id: true, status: true, empathy_count: true } });
    if (!story) return { ok: false, error: "not_found" };
    // 공감 많이 받은 글은 악의적 신고 몇 번으로 안 내려가게 기준을 올림
    const hideAt = story.empathy_count >= 50 ? REPORT_HIDE_COUNT + 2 : REPORT_HIDE_COUNT;
    const r = (REPORT_REASONS as readonly string[]).includes(reason) ? reason : "other";
    const dup = await prisma.report.findUnique({ where: { story_id_voter_key: { story_id: storyId, voter_key: voterKey } } });
    if (dup) return { ok: false, error: "dup" };
    try {
        await prisma.report.create({ data: { story_id: storyId, voter_key: voterKey, reason: r } });
    } catch {
        return { ok: false, error: "dup" };
    }
    const distinct = await prisma.report.groupBy({ by: ["voter_key"], where: { story_id: storyId } });
    const count = distinct.length;
    const hide = count >= hideAt && story.status === "public";
    await prisma.story.update({
        where: { id: storyId },
        data: { report_count: count, ...(hide ? { status: "hidden", moderation_note: "reports" } : {}) },
    });
    return { ok: true, reportCount: count, hidden: hide || story.status === "hidden" };
}

// ---------- 내 이야기 ----------
// 지구본 불빛 하나 = 나라 하나 (city 는 안 씀, 호환용)
export type CityLight = { country: string | null; city: string | null; lat: number; lng: number; count: number; mine: boolean };
export type MineResult = {
    stories: StoryView[];
    total: number;
    countryCount: number;
    lights: CityLight[];
    myCountry: string | null;
    myCity: string | null;
};

export async function getMine(ownerTokenHash: string, lang: Lang): Promise<MineResult> {
    const rows = await prisma.story.findMany({ where: { owner_token_hash: ownerTokenHash, status: { not: "removed" } }, orderBy: { created_at: "desc" } });
    const stories = await toStoryViews(rows, lang, undefined, ownerTokenHash);
    const ids = rows.map((r) => r.id);
    const total = rows.reduce((s, r) => s + r.empathy_count, 0);
    const emp = ids.length ? await prisma.empathy.groupBy({ by: ["country", "city", "lat", "lng"], where: { story_id: { in: ids } }, _count: { _all: true } }) : [];
    const countries = new Set(emp.map((e) => e.country).filter(Boolean));
    const myCountry = rows.find((r) => r.country)?.country ?? null;
    const myCity = rows.find((r) => r.city)?.city ?? null;
    // 나라마다 불빛 하나. 좌표는 그 나라에서 온 공감 좌표의 평균 (도시 추정이 거칠어서 도시 단위는 안 씀)
    const byCountry = new Map<string, { n: number; lat: number; lng: number; w: number }>();
    for (const e of emp) {
        if (!e.country) continue;
        const c = byCountry.get(e.country) ?? { n: 0, lat: 0, lng: 0, w: 0 };
        c.n += e._count._all;
        if (typeof e.lat === "number" && typeof e.lng === "number") {
            c.lat += e.lat * e._count._all;
            c.lng += e.lng * e._count._all;
            c.w += e._count._all;
        }
        byCountry.set(e.country, c);
    }
    const lights: CityLight[] = [...byCountry.entries()]
        .filter(([, c]) => c.w > 0)
        .map(([country, c]) => ({ country, city: null, lat: c.lat / c.w, lng: c.lng / c.w, count: c.n, mine: country === myCountry }))
        .sort((a, b) => b.count - a.count);
    return { stories, total, countryCount: countries.size, lights, myCountry, myCity };
}

// ---------- 주인 기능: 수정(10분)·삭제(10분)·내리기/다시 올리기(언제든) ----------
export type OwnerResult = { ok: true; story: StoryView } | { ok: false; error: "not_found" | "forbidden" | "expired" | "empty" | "too_long" | "url" | "banned" | "state" };

type Owned = { ok: true; row: StoryRow } | { ok: false; error: "not_found" | "forbidden" };
async function ownedStory(id: number, ownerTokenHash: string): Promise<Owned> {
    const row = await prisma.story.findUnique({ where: { id } });
    if (!row || row.status === "removed") return { ok: false, error: "not_found" };
    if (row.owner_token_hash !== ownerTokenHash) return { ok: false, error: "forbidden" };
    return { ok: true, row };
}

export async function editStory(id: number, ownerTokenHash: string, body: string, lang: Lang): Promise<OwnerResult> {
    const r = await ownedStory(id, ownerTokenHash);
    if (!r.ok) return { ok: false, error: r.error };
    if (Date.now() - r.row.created_at.getTime() > EDIT_WINDOW_MS) return { ok: false, error: "expired" };
    if (r.row.status === "hidden") return { ok: false, error: "state" };
    const m = moderate(body);
    if (!m.ok) return { ok: false, error: m.reason! };
    // 위험 낱말이 새로 들어오면 비공개로, 빠지면 원래대로(공개)
    const status = m.crisis ? "private" : r.row.moderation_note === "crisis" ? "public" : r.row.status;
    const updated = await prisma.story.update({
        where: { id },
        data: { body: m.body, status, moderation_note: m.crisis ? "crisis" : r.row.moderation_note === "crisis" ? null : r.row.moderation_note, edited_at: new Date(), published_at: status === "public" && !r.row.published_at ? new Date() : r.row.published_at },
    });
    memoClear(`top:${updated.room_id}`);
    return { ok: true, story: (await toStoryViews([updated], lang, undefined, ownerTokenHash))[0] };
}

export async function deleteStory(id: number, ownerTokenHash: string): Promise<{ ok: true } | { ok: false; error: "not_found" | "forbidden" | "expired" }> {
    const r = await ownedStory(id, ownerTokenHash);
    if (!r.ok) return { ok: false, error: r.error };
    if (Date.now() - r.row.created_at.getTime() > EDIT_WINDOW_MS) return { ok: false, error: "expired" };
    await prisma.story.delete({ where: { id } });
    memoClear("rooms:");
    memoClear(`top:${r.row.room_id}`);
    return { ok: true };
}

export async function setWithdrawn(id: number, ownerTokenHash: string, withdrawn: boolean, lang: Lang): Promise<OwnerResult> {
    const r = await ownedStory(id, ownerTokenHash);
    if (!r.ok) return { ok: false, error: r.error };
    if (withdrawn && r.row.status !== "public") return { ok: false, error: "state" };
    if (!withdrawn && r.row.status !== "withdrawn") return { ok: false, error: "state" };
    const updated = await prisma.story.update({ where: { id }, data: { status: withdrawn ? "withdrawn" : "public" } });
    memoClear("rooms:");
    memoClear(`top:${updated.room_id}`);
    return { ok: true, story: (await toStoryViews([updated], lang, undefined, ownerTokenHash))[0] };
}
