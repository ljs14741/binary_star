import { prisma } from "./prisma";
import type { Lang } from "./i18n/config";
import { TOP_MIN_SAMPLE } from "./site";
import { toStoryViews, type StoryView } from "./stories";
import { memo } from "./cache";

export type RoomView = {
    id: number;
    slug: string;
    title: string;
    description: string;
    storyCount: number;
    featuredUntil: string | null; // ISO
    featuredClosed: boolean;
    status: string;
};

type RoomRow = { id: number; slug: string; featured_until: Date | null; status: string; sort_order: number; i18n: { lang: string; title: string; description: string }[] };

export function pickI18n(i18n: { lang: string; title: string; description: string }[], lang: Lang) {
    return i18n.find((r) => r.lang === lang) || i18n.find((r) => r.lang === "en") || i18n.find((r) => r.lang === "ko") || i18n[0];
}

function toRoomView(r: RoomRow, lang: Lang, storyCount: number): RoomView {
    const t = pickI18n(r.i18n, lang);
    return {
        id: r.id,
        slug: r.slug,
        title: t?.title ?? r.slug,
        description: t?.description ?? "",
        storyCount,
        featuredUntil: r.featured_until ? r.featured_until.toISOString() : null,
        featuredClosed: !!r.featured_until && r.featured_until.getTime() < Date.now(),
        status: r.status,
    };
}

async function storyCounts(roomIds: number[]): Promise<Map<number, number>> {
    if (roomIds.length === 0) return new Map();
    const rows = await prisma.story.groupBy({ by: ["room_id"], where: { room_id: { in: roomIds }, status: "public" }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.room_id, r._count._all]));
}

export async function listRooms(lang: Lang): Promise<RoomView[]> {
    return memo(`rooms:${lang}`, 30_000, async () => {
        const rooms = await prisma.room.findMany({ where: { status: "open" }, include: { i18n: true }, orderBy: [{ sort_order: "asc" }, { id: "asc" }] });
        const counts = await storyCounts(rooms.map((r) => r.id));
        return rooms.map((r) => toRoomView(r, lang, counts.get(r.id) ?? 0));
    });
}

export async function getRoomBySlug(slug: string, lang: Lang): Promise<RoomView | null> {
    const r = await prisma.room.findUnique({ where: { slug }, include: { i18n: true } });
    if (!r) return null;
    const counts = await storyCounts([r.id]);
    return toRoomView(r, lang, counts.get(r.id) ?? 0);
}

// 이번 달 주제: featured_until 이 있는 방 중 가장 최근 것 (마감 지났어도 결과 화면용으로 돌려줌)
export async function getFeaturedRoom(lang: Lang): Promise<RoomView | null> {
    return memo(`rooms:featured:${lang}`, 30_000, async () => {
        const r = await prisma.room.findFirst({ where: { featured_until: { not: null }, status: "open" }, include: { i18n: true }, orderBy: { featured_until: "desc" } });
        if (!r) return null;
        const counts = await storyCounts([r.id]);
        return toRoomView(r, lang, counts.get(r.id) ?? 0);
    });
}

// 마감 시각 전에 공개된 이야기 중 공감 1위
export async function getFeaturedWinner(room: RoomView, lang: Lang, voterKey?: string): Promise<StoryView | null> {
    if (!room.featuredUntil) return null;
    const rows = await prisma.story.findMany({
        where: { room_id: room.id, status: "public", published_at: { lte: new Date(room.featuredUntil) } },
        orderBy: [{ empathy_count: "desc" }, { published_at: "asc" }],
        take: 1,
    });
    const views = await toStoryViews(rows, lang, voterKey);
    return views[0] ?? null;
}

export type TopGroup = { key: string; count: number; story: StoryView | null };
export type TopResult = { all: StoryView[]; byAge: TopGroup[]; byCountry: TopGroup[] };

type TopSkeleton = { allIds: number[]; byAge: { key: string; count: number; id: number | null }[]; byCountry: { key: string; count: number; id: number | null }[] };

async function topSkeleton(roomId: number): Promise<TopSkeleton> {
    const base = { room_id: roomId, status: "public" as const };
    const all = await prisma.story.findMany({ where: base, orderBy: [{ empathy_count: "desc" }, { published_at: "asc" }], take: 3, select: { id: true } });
    const ageCounts = await prisma.story.groupBy({ by: ["age_group"], where: { ...base, age_group: { not: null } }, _count: { _all: true } });
    const countryCounts = await prisma.story.groupBy({ by: ["country"], where: { ...base, country: { not: null } }, _count: { _all: true } });
    async function topOf(where: Record<string, unknown>) {
        const r = await prisma.story.findFirst({ where: { ...base, ...where }, orderBy: [{ empathy_count: "desc" }, { published_at: "asc" }], select: { id: true } });
        return r?.id ?? null;
    }
    const byAge = await Promise.all(
        ageCounts
            .filter((g) => g.age_group)
            .sort((a, b) => (a.age_group! < b.age_group! ? -1 : 1))
            .map(async (g) => ({ key: g.age_group!, count: g._count._all, id: g._count._all >= TOP_MIN_SAMPLE ? await topOf({ age_group: g.age_group }) : null }))
    );
    const byCountry = await Promise.all(
        countryCounts
            .filter((g) => g.country)
            .sort((a, b) => b._count._all - a._count._all)
            .slice(0, 20)
            .map(async (g) => ({ key: g.country!, count: g._count._all, id: g._count._all >= TOP_MIN_SAMPLE ? await topOf({ country: g.country }) : null }))
    );
    return { allIds: all.map((r) => r.id), byAge, byCountry };
}

export async function getTop(roomId: number, lang: Lang, voterKey?: string): Promise<TopResult> {
    const sk = await memo(`top:${roomId}`, 60_000, () => topSkeleton(roomId));
    const ids = [...new Set([...sk.allIds, ...sk.byAge.map((g) => g.id), ...sk.byCountry.map((g) => g.id)].filter((x): x is number => !!x))];
    const rows = ids.length ? await prisma.story.findMany({ where: { id: { in: ids }, status: "public" } }) : [];
    const views = await toStoryViews(rows, lang, voterKey);
    const byId = new Map(views.map((v) => [v.id, v]));
    return {
        all: sk.allIds.map((id) => byId.get(id)).filter((v): v is StoryView => !!v),
        byAge: sk.byAge.map((g) => ({ key: g.key, count: g.count, story: g.id ? byId.get(g.id) ?? null : null })),
        byCountry: sk.byCountry.map((g) => ({ key: g.key, count: g.count, story: g.id ? byId.get(g.id) ?? null : null })),
    };
}
