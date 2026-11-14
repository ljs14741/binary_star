// DB(MySQL star)를 실제로 쓰는 테스트. 만든 데이터는 끝나면 지움
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStory, toggleEmpathy, reportStory, getFeed, getMine, getPublicStory } from "@/lib/stories";
import { createProposal, toggleProposalEmpathy } from "@/lib/proposals";
import { getTop } from "@/lib/rooms";
import { hashOwnerToken } from "@/lib/crypto";
import { resetRateLimit } from "@/lib/ratelimit";
import { PROPOSAL_THRESHOLD, REPORT_HIDE_COUNT } from "@/lib/site";
import { EMPTY_GEO } from "@/lib/geo";

const SLUG = "__test_room__";
const seoul = { country: "KR", city: "Seoul", lat: 37.6, lng: 127.0 };
const tokyo = { country: "JP", city: "Tokyo", lat: 35.7, lng: 139.7 };
const vk = (n: string) => `test-voter-${n}-`.padEnd(64, "x"); // 끝을 "-" 로 막아 pe1·pe10 이 같은 키가 되지 않게

beforeAll(async () => {
    await prisma.room.upsert({
        where: { slug: SLUG },
        create: { slug: SLUG, sort_order: 999, i18n: { create: [{ lang: "ko", title: "테스트 방", description: "" }, { lang: "en", title: "Test room", description: "" }] } },
        update: {},
    });
    resetRateLimit();
});

afterAll(async () => {
    await prisma.room.deleteMany({ where: { slug: { startsWith: "__test" } } });
    await prisma.room.deleteMany({ where: { slug: { startsWith: "p" }, i18n: { some: { title: { startsWith: "__테스트 제안" } } } } });
    await prisma.room_proposal.deleteMany({ where: { title: { startsWith: "__테스트 제안" } } });
    await prisma.$disconnect();
});

describe("이야기 작성·검수", () => {
    it("정상 글은 바로 공개, 개인정보는 가려짐, owner 토큰 발급", async () => {
        const r = await createStory({ roomSlug: SLUG, body: "테스트 글. 연락처 010-9999-8888", lang: "ko", voterKey: vk("a"), geo: seoul });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.story.status).toBe("public");
        expect(r.story.body).not.toContain("9999");
        expect(r.masked).toBe(true);
        expect(r.ownerToken.length).toBeGreaterThan(32);
        const mine = await getMine(hashOwnerToken(r.ownerToken), "ko");
        expect(mine.stories.map((s) => s.id)).toContain(r.story.id);
    });
    it("위험 낱말은 private 로 저장돼 공개 피드에 안 나옴", async () => {
        const r = await createStory({ roomSlug: SLUG, body: "죽고 싶다", lang: "ko", voterKey: vk("b"), geo: seoul });
        expect(r.ok && r.story.status).toBe("private");
        expect(r.ok && r.crisis).toBe(true);
        if (!r.ok) return;
        expect(await getPublicStory(r.story.id, "ko")).toBeNull();
    });
    it("금칙어·링크는 거부", async () => {
        expect(await createStory({ roomSlug: SLUG, body: "병신", lang: "ko", voterKey: vk("c"), geo: EMPTY_GEO })).toMatchObject({ ok: false, error: "banned" });
        expect(await createStory({ roomSlug: SLUG, body: "https://x.com", lang: "ko", voterKey: vk("c"), geo: EMPTY_GEO })).toMatchObject({ ok: false, error: "url" });
        expect(await createStory({ roomSlug: "no-such-room", body: "hi", lang: "en", voterKey: vk("c"), geo: EMPTY_GEO })).toMatchObject({ ok: false, error: "room" });
    });
    it("하루 10개 제한", async () => {
        for (let i = 0; i < 10; i++) expect((await createStory({ roomSlug: SLUG, body: `limit ${i}`, lang: "en", voterKey: vk("lim"), geo: EMPTY_GEO })).ok).toBe(true);
        expect(await createStory({ roomSlug: SLUG, body: "one more", lang: "en", voterKey: vk("lim"), geo: EMPTY_GEO })).toMatchObject({ ok: false, error: "limit" });
    });
});

describe("공감", () => {
    it("1인 1회(취소 가능), 내 글 불가, 나라 수·지구본 좌표", async () => {
        const r = await createStory({ roomSlug: SLUG, body: "공감 테스트", lang: "ko", voterKey: vk("owner"), geo: seoul });
        if (!r.ok) throw new Error("create failed");
        const id = r.story.id;
        expect(await toggleEmpathy(id, vk("owner"), tokyo)).toMatchObject({ ok: false, error: "own" });
        expect(await toggleEmpathy(id, vk("x"), tokyo)).toMatchObject({ ok: true, empathized: true, count: 1 });
        expect(await toggleEmpathy(id, vk("x"), tokyo)).toMatchObject({ ok: true, empathized: false, count: 0 });
        expect(await toggleEmpathy(id, vk("x"), tokyo)).toMatchObject({ ok: true, empathized: true, count: 1 });
        expect(await toggleEmpathy(id, vk("y"), seoul)).toMatchObject({ ok: true, empathized: true, count: 2 });
        expect(await prisma.empathy.count({ where: { story_id: id } })).toBe(2);
        const v = await getPublicStory(id, "ko", vk("x"));
        expect(v?.empathyCount).toBe(2);
        expect(v?.countryCount).toBe(2);
        expect(v?.empathized).toBe(true);
        expect(v?.rising24h).toBe(2);
        const mine = await getMine(hashOwnerToken(r.ownerToken), "ko");
        expect(mine.total).toBe(2);
        expect(mine.countryCount).toBe(2);
        expect(mine.lights.find((l) => l.city === "Tokyo")?.count).toBe(1);
        expect(mine.lights.find((l) => l.city === "Seoul")?.mine).toBe(true);
    });
});

describe("신고", () => {
    it(`서로 다른 ${REPORT_HIDE_COUNT}명이 신고하면 숨김, 같은 사람 중복은 안 셈`, async () => {
        const r = await createStory({ roomSlug: SLUG, body: "신고 테스트", lang: "ko", voterKey: vk("o2"), geo: seoul });
        if (!r.ok) throw new Error("create failed");
        const id = r.story.id;
        expect(await reportStory(id, vk("r1"), "spam")).toMatchObject({ ok: true, reportCount: 1, hidden: false });
        expect(await reportStory(id, vk("r1"), "abuse")).toMatchObject({ ok: false, error: "dup" });
        expect(await reportStory(id, vk("r2"), "spam")).toMatchObject({ ok: true, reportCount: 2, hidden: false });
        expect(await getPublicStory(id, "ko")).not.toBeNull();
        expect(await reportStory(id, vk("r3"), "pii")).toMatchObject({ ok: true, reportCount: 3, hidden: true });
        expect(await getPublicStory(id, "ko")).toBeNull();
        expect((await prisma.story.findUnique({ where: { id } }))?.status).toBe("hidden");
    });
});

describe("피드·1위", () => {
    it("공유 링크 이야기가 먼저, 본 것은 제외", async () => {
        const a = await createStory({ roomSlug: SLUG, body: "feed A", lang: "en", voterKey: vk("f1"), geo: EMPTY_GEO });
        const b = await createStory({ roomSlug: SLUG, body: "feed B", lang: "en", voterKey: vk("f2"), geo: EMPTY_GEO });
        if (!a.ok || !b.ok) throw new Error("create failed");
        const f = await getFeed({ roomSlug: SLUG, lang: "ko", firstId: b.story.id, limit: 10 });
        expect(f.stories[0].id).toBe(b.story.id);
        const f2 = await getFeed({ roomSlug: SLUG, lang: "ko", exclude: [a.story.id, b.story.id], limit: 50 });
        expect(f2.stories.map((s) => s.id)).not.toContain(a.story.id);
        // private·hidden 은 절대 안 나옴
        const statuses = await prisma.story.findMany({ where: { id: { in: f2.stories.map((s) => s.id) } }, select: { status: true } });
        expect(statuses.every((s) => s.status === "public")).toBe(true);
    });
    it("표본 5개 미만 그룹은 1위 대신 '아직 적어요'", async () => {
        const room = await prisma.room.findUnique({ where: { slug: SLUG } });
        const top = await getTop(room!.id, "ko");
        expect(top.all.length).toBeGreaterThan(0);
        expect(top.all[0].empathyCount).toBeGreaterThanOrEqual(top.all[top.all.length - 1].empathyCount);
        const kr = top.byCountry.find((g) => g.key === "KR");
        expect(kr).toBeDefined();
        if (kr && kr.count < 5) expect(kr.story).toBeNull();
    });
});

describe("주제 제안", () => {
    it(`공감 ${PROPOSAL_THRESHOLD}개면 정식 방이 됨 (4개 언어 이름 포함)`, async () => {
        const p = await createProposal("__테스트 제안 방", "ko", vk("p0"), seoul);
        expect(p.ok).toBe(true);
        if (!p.ok) return;
        expect(await createProposal("__테스트 제안 방", "ko", vk("p1"), seoul)).toMatchObject({ ok: false, error: "dup" });
        expect(await createProposal("https://spam.com", "ko", vk("p1"), seoul)).toMatchObject({ ok: false, error: "banned" });
        let slug: string | null = null;
        for (let i = 0; i < PROPOSAL_THRESHOLD; i++) {
            const r = await toggleProposalEmpathy(p.proposal.id, vk(`pe${i}`));
            expect(r.ok).toBe(true);
            if (r.ok && r.promotedSlug) slug = r.promotedSlug;
        }
        expect(slug).toBeTruthy();
        const room = await prisma.room.findUnique({ where: { slug: slug! }, include: { i18n: true } });
        expect(room?.i18n.map((i) => i.lang).sort()).toEqual(["en", "ja", "ko", "zh-TW"]);
        expect((await prisma.room_proposal.findUnique({ where: { id: p.proposal.id } }))?.status).toBe("promoted");
        // 승격된 방에 바로 글을 쓸 수 있음
        const s = await createStory({ roomSlug: slug!, body: "새 방 첫 글", lang: "ko", voterKey: vk("p9"), geo: seoul });
        expect(s.ok).toBe(true);
        // 하루 3개 제한
        await createProposal("__테스트 제안 2", "ko", vk("p0"), seoul);
        await createProposal("__테스트 제안 3", "ko", vk("p0"), seoul);
        expect(await createProposal("__테스트 제안 4", "ko", vk("p0"), seoul)).toMatchObject({ ok: false, error: "limit" });
    });
});

// ---------- 밤의 언덕 하늘 ----------
import { getSky, STARS_PER_ROOM } from "@/lib/hill";
import { azDelta, ringLayout, starPoint, SKY_ORIGIN, DOME_R } from "@/components/hill/sky";
import { assignRooms, SHAPES, shapeFor, ZODIAC, zodiacIndexFor } from "@/components/hill/constellations";

describe("언덕 하늘", () => {
    it("방마다 별자리 하나, 별은 방당 10개 이하, 공개 이야기만", async () => {
        const sky = await getSky("ko");
        expect(sky.rooms.length).toBeGreaterThan(0);
        for (const r of sky.rooms) {
            expect(r.stars.length).toBeLessThanOrEqual(STARS_PER_ROOM);
            for (const s of r.stars) expect(s.room).toBe(r.slug);
            // 공감 많은 순
            const counts = r.stars.filter((s) => s.c > 0).map((s) => s.c);
            expect([...counts].sort((a, b) => b - a)).toEqual(counts);
        }
    });

    it("황도 12궁: 모양은 점 10개·선은 점 번호 안, 이름 4개 언어, 방은 어울리는 별자리에", () => {
        expect(ZODIAC.length).toBe(12);
        expect(SHAPES).toBe(ZODIAC);
        for (const sh of ZODIAC) {
            expect(sh.points.length).toBe(10);
            for (const [a, b] of sh.lines) {
                expect(a).toBeLessThan(sh.points.length);
                expect(b).toBeLessThan(sh.points.length);
            }
            for (const l of ["ko", "en", "ja", "zh-TW"] as const) expect(sh.names[l].length).toBeGreaterThan(0);
            expect(sh.symbol.length).toBeGreaterThan(0);
        }
        expect(shapeFor("first-love", 1).name).toBe("pisces");
        expect(zodiacIndexFor("unknown-room")).toBeNull();
        // 정해진 방은 그 자리, 모르는 방은 빈 별자리부터. 겹치지 않음
        const a = assignRooms(["first-love", "to-my-twenties", "new-room-1", "new-room-2"]);
        expect(ZODIAC[a.get("first-love")!].name).toBe("pisces");
        expect(ZODIAC[a.get("to-my-twenties")!].name).toBe("aries");
        expect(new Set(a.values()).size).toBe(4);
        expect(ZODIAC[a.get("new-room-1")!].name).toBe("taurus");
    });

    it("별자리 12개가 360도 고리에 30도 간격으로, 별은 별자리 둘레 안에", () => {
        const cells = ringLayout(12);
        expect(cells.length).toBe(12);
        for (let i = 0; i < 12; i++) expect(cells[i].az).toBeCloseTo(i * 30);
        expect(azDelta(350, 10)).toBe(-20);
        expect(azDelta(10, 350)).toBe(20);
        expect(azDelta(180, 0)).toBe(180);
        const c = cells[3];
        const center = starPoint(c, 0, 0);
        const edge = starPoint(c, 1, 0);
        const dc = Math.hypot(center.x - SKY_ORIGIN.x, center.y - SKY_ORIGIN.y, center.z - SKY_ORIGIN.z);
        expect(dc).toBeCloseTo(DOME_R, 3);
        // 가장자리 별은 중심에서 반지름(도)만큼 떨어짐
        const dot = ((center.x - SKY_ORIGIN.x) * (edge.x - SKY_ORIGIN.x) + (center.y - SKY_ORIGIN.y) * (edge.y - SKY_ORIGIN.y) + (center.z - SKY_ORIGIN.z) * (edge.z - SKY_ORIGIN.z)) / (DOME_R * DOME_R);
        expect((Math.acos(dot) * 180) / Math.PI).toBeCloseTo(c.half, 0);
    });
});
