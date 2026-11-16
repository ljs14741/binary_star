// 밤의 언덕: 하늘에 띄울 별(이야기) 목록, 오늘의 이야기, 이번 달 마감 발표
import { prisma } from "./prisma";
import { memo } from "./cache";
import type { Lang } from "./i18n/config";
import { excerpt } from "./format";
import { getFeaturedRoom, getFeaturedWinner, listRooms } from "./rooms";
import { toStoryViews, type StoryView } from "./stories";

export const STARS_PER_ROOM = 10;

export type SkyStar = { id: number; room: string; c: number; lang: string; nick: string | null; line: string; at: number };
export type SkyRoom = { slug: string; title: string; sector: number; count: number; stars: SkyStar[] }; // count: 공개 이야기 수 (주제 판에 표시)
export type SkyData = { rooms: SkyRoom[]; generatedAt: number };

// 하늘: 방마다 별자리 하나 = 그 방에서 공감 많은 이야기 10개 (모자라면 최근 공개 글로 채움). 30초 캐시
export async function getSky(lang: Lang): Promise<SkyData> {
    return memo(`hill:sky:${lang}`, 30_000, async () => {
        const rooms = await listRooms(lang);
        const sel = { id: true, empathy_count: true, lang: true, nickname: true, body: true, published_at: true, room: { select: { slug: true } } } as const;
        const out: SkyRoom[] = [];
        for (const [i, r] of rooms.entries()) {
            const [popular, fresh] = await Promise.all([
                prisma.story.findMany({ where: { room_id: r.id, status: "public", empathy_count: { gte: 1 } }, orderBy: [{ empathy_count: "desc" }, { published_at: "desc" }], take: STARS_PER_ROOM, select: sel }),
                prisma.story.findMany({ where: { room_id: r.id, status: "public" }, orderBy: { published_at: "desc" }, take: STARS_PER_ROOM, select: sel }),
            ]);
            const seen = new Set<number>();
            const stars: SkyStar[] = [];
            for (const s of [...popular, ...fresh]) {
                if (seen.has(s.id) || stars.length >= STARS_PER_ROOM) continue;
                seen.add(s.id);
                stars.push({ id: s.id, room: s.room.slug, c: s.empathy_count, lang: s.lang, nick: s.nickname, line: excerpt(s.body, 70), at: s.published_at ? s.published_at.getTime() : 0 });
            }
            out.push({ slug: r.slug, title: r.title, sector: i, count: r.storyCount, stars });
        }
        return { rooms: out, generatedAt: Date.now() };
    });
}

function kstDate(now = Date.now()): string {
    return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 오늘의 이야기: 지난 24시간 공감 증가 1위. 없으면 최근 공개 이야기 중 무작위. 날짜(KST)별 캐시
export async function getDailyStory(lang: Lang, voterKey?: string): Promise<StoryView | null> {
    const id = await memo(`hill:daily:${kstDate()}`, 24 * 3600 * 1000, async () => {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const top = await prisma.empathy.groupBy({
            by: ["story_id"],
            where: { created_at: { gte: since }, story: { status: "public", is_seed: false } },
            _count: { story_id: true },
            orderBy: { _count: { story_id: "desc" } },
            take: 1,
        });
        if (top[0]) return top[0].story_id;
        const recent = await prisma.story.findMany({ where: { status: "public" }, orderBy: { published_at: "desc" }, take: 30, select: { id: true } });
        if (recent.length === 0) return null;
        return recent[Math.floor(Math.random() * recent.length)].id;
    });
    if (!id) return null;
    const row = await prisma.story.findFirst({ where: { id, status: "public" } });
    if (!row) return null;
    return (await toStoryViews([row], lang, voterKey))[0] ?? null;
}

// 이번 달 주제 마감이 최근 windowMs 안에 지났으면 1위 (서버가 1분마다 물어봄)
export async function getFeaturedDue(lang: Lang, windowMs = 120_000): Promise<{ due: string; story: StoryView | null } | null> {
    const room = await getFeaturedRoom(lang);
    if (!room?.featuredUntil) return null;
    const until = new Date(room.featuredUntil).getTime();
    const now = Date.now();
    if (until > now || now - until > windowMs) return null;
    const story = await getFeaturedWinner(room, lang);
    return { due: new Date(until).toISOString(), story };
}

export type Presence = { total: number; countries: Record<string, number> };
export type LivePresence = Presence & { hills: { name: string; count: number }[]; peak: { n: number; at: number }; cap: number };

async function rtStats(): Promise<Partial<LivePresence>> {
    const base = process.env.RT_EMIT_URL || `http://127.0.0.1:${process.env.PORT || 3100}`;
    const r = await fetch(`${base}/_rt/stats`, { method: "POST", headers: { "x-rt-secret": process.env.STAR_SECRET || "star-dev-secret" }, signal: AbortSignal.timeout(800), cache: "no-store" });
    return (await r.json()) as Partial<LivePresence>;
}

// 실시간 허브 현황 (SSR·2D 대체 화면용). 허브 없으면 0
export async function getPresence(): Promise<Presence> {
    try {
        const j = await rtStats();
        return { total: j.total || 0, countries: j.countries || {} };
    } catch {
        return { total: 0, countries: {} };
    }
}

// 관리자용: 언덕별 인원·오늘 최고 동시 접속까지
export async function getLivePresence(): Promise<LivePresence | null> {
    try {
        const j = await rtStats();
        return { total: j.total || 0, countries: j.countries || {}, hills: j.hills || [], peak: j.peak || { n: 0, at: 0 }, cap: j.cap || 60 };
    } catch {
        return null;
    }
}
