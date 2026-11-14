// 2차 기능: 별명 검수, 수정/삭제 10분 제한, 내리기/다시 올리기, IP 대역 공감 제한
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanNickname, createStory, editStory, deleteStory, setWithdrawn, toggleEmpathy, getPublicStory, getMine } from "@/lib/stories";
import { hashOwnerToken } from "@/lib/crypto";
import { resetRateLimit } from "@/lib/ratelimit";
import { EMPATHY_PER_IP_PER_STORY_DAY } from "@/lib/site";

const SLUG = "__test_owner__";
const seoul = { country: "KR", city: "Seoul", lat: 37.6, lng: 127.0 };
const vk = (n: string) => `own-voter-${n}-`.padEnd(64, "x");

beforeAll(async () => {
    await prisma.room.upsert({ where: { slug: SLUG }, create: { slug: SLUG, sort_order: 998, i18n: { create: [{ lang: "ko", title: "주인 테스트", description: "" }] } }, update: {} });
    resetRateLimit();
});
afterAll(async () => {
    await prisma.room.deleteMany({ where: { slug: SLUG } });
    await prisma.$disconnect();
});

async function make(body = "주인 기능 테스트 글", nickname: string | null = "별명테스트") {
    const r = await createStory({ roomSlug: SLUG, body, nickname, lang: "ko", voterKey: vk("o" + Math.random()), geo: seoul });
    if (!r.ok) throw new Error("create failed " + r.error);
    return { id: r.story.id, hash: hashOwnerToken(r.ownerToken), view: r.story };
}

describe("별명", () => {
    it("정리·제한·금칙어", () => {
        expect(cleanNickname("  밤하늘   고양이  ")).toEqual({ ok: true, value: "밤하늘 고양이" });
        expect(cleanNickname("")).toEqual({ ok: true, value: null });
        expect(cleanNickname("아주아주아주긴별명은잘림")).toEqual({ ok: true, value: "아주아주아주긴별명은" });
        expect(cleanNickname("병신").ok).toBe(false);
        expect(cleanNickname("010-1234-5678").ok).toBe(false);
        expect(cleanNickname("@handle").ok).toBe(false);
    });
    it("카드에 별명이 붙고, 없으면 null", async () => {
        const a = await make("별명 있음", "별 하나");
        expect(a.view.nickname).toBe("별 하나");
        const b = await make("별명 없음", null);
        expect(b.view.nickname).toBeNull();
        expect(await createStory({ roomSlug: SLUG, body: "x", nickname: "시발", lang: "ko", voterKey: vk("n"), geo: seoul })).toMatchObject({ ok: false, error: "nickname" });
    });
});

describe("수정·삭제·내리기", () => {
    it("주인만, 10분 안에만 수정", async () => {
        const s = await make();
        expect(s.view.canEdit).toBe(true);
        const other = hashOwnerToken("someone-else-token-xxxxxxxxxxxxxxxxxxxxxxxx");
        expect(await editStory(s.id, other, "남의 글 수정", "ko")).toMatchObject({ ok: false, error: "forbidden" });
        const r = await editStory(s.id, s.hash, "고친 글 010-1111-2222", "ko");
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.story.body).toContain("고친 글");
            expect(r.story.body).not.toContain("1111");
            expect(r.story.editedAt).toBeTruthy();
        }
        expect(await editStory(s.id, s.hash, "https://x.com", "ko")).toMatchObject({ ok: false, error: "url" });
        // 10분 지난 것처럼
        await prisma.story.update({ where: { id: s.id }, data: { created_at: new Date(Date.now() - 11 * 60_000) } });
        expect(await editStory(s.id, s.hash, "늦은 수정", "ko")).toMatchObject({ ok: false, error: "expired" });
        expect(await deleteStory(s.id, s.hash)).toMatchObject({ ok: false, error: "expired" });
        const mine = await getMine(s.hash, "ko");
        expect(mine.stories[0].canEdit).toBe(false);
    });
    it("수정으로 위험 낱말이 들어오면 비공개, 빠지면 다시 공개", async () => {
        const s = await make();
        const r1 = await editStory(s.id, s.hash, "요즘 죽고 싶다", "ko");
        expect(r1.ok && r1.story.status).toBe("private");
        const r2 = await editStory(s.id, s.hash, "다시 괜찮아졌어", "ko");
        expect(r2.ok && r2.story.status).toBe("public");
    });
    it("10분 안 삭제는 진짜 삭제", async () => {
        const s = await make();
        expect(await deleteStory(s.id, s.hash)).toEqual({ ok: true });
        expect(await prisma.story.findUnique({ where: { id: s.id } })).toBeNull();
    });
    it("내리기는 언제든, 공감은 유지, 다시 올리기 가능", async () => {
        const s = await make();
        expect(await toggleEmpathy(s.id, vk("e1"), seoul)).toMatchObject({ ok: true, count: 1 });
        await prisma.story.update({ where: { id: s.id }, data: { created_at: new Date(Date.now() - 60 * 60_000) } });
        const down = await setWithdrawn(s.id, s.hash, true, "ko");
        expect(down.ok && down.story.status).toBe("withdrawn");
        expect(await getPublicStory(s.id, "ko")).toBeNull();
        expect(await toggleEmpathy(s.id, vk("e2"), seoul)).toMatchObject({ ok: false, error: "not_found" });
        expect(await setWithdrawn(s.id, s.hash, true, "ko")).toMatchObject({ ok: false, error: "state" });
        const up = await setWithdrawn(s.id, s.hash, false, "ko");
        expect(up.ok && up.story.status).toBe("public");
        expect(up.ok && up.story.empathyCount).toBe(1);
        expect((await getMine(s.hash, "ko")).total).toBe(1);
    });
});

describe("거짓 공감 방지", () => {
    it(`같은 IP 대역은 이야기당 하루 ${EMPATHY_PER_IP_PER_STORY_DAY}번까지`, async () => {
        const s = await make();
        const ip = "iphash-A".padEnd(64, "0");
        for (let i = 0; i < EMPATHY_PER_IP_PER_STORY_DAY; i++) {
            expect(await toggleEmpathy(s.id, vk(`ip${i}`), seoul, undefined, ip)).toMatchObject({ ok: true, empathized: true });
        }
        expect(await toggleEmpathy(s.id, vk("ip-extra"), seoul, undefined, ip)).toMatchObject({ ok: false, error: "limit" });
        // 다른 IP 대역은 됨
        expect(await toggleEmpathy(s.id, vk("ip-other"), seoul, undefined, "iphash-B".padEnd(64, "0"))).toMatchObject({ ok: true, count: EMPATHY_PER_IP_PER_STORY_DAY + 1 });
        // 이미 누른 사람이 취소하는 건 제한과 무관
        expect(await toggleEmpathy(s.id, vk("ip0"), seoul, undefined, ip)).toMatchObject({ ok: true, empathized: false });
    });
});
