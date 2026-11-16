import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { adminWishAction, cheerWish, createWish, listSky, reportWish, WISH_PER_DAY, WISH_SKY_HOURS, WISH_SKY_MIN } from "@/lib/wishes";

const vk = (n: string) => `test-wish-${n}-`.padEnd(64, "x");
const ip = (n: string) => `test-wish-ip-${n}`;

afterAll(async () => {
    await prisma.wish.deleteMany({ where: { voter_key: { startsWith: "test-wish-" } } });
    await prisma.$disconnect();
});

describe("소원 부두", () => {
    it("빌면 하늘에 뜨고, 금칙어·링크는 막힘, 하루 3번까지", async () => {
        const r = await createWish({ body: "  올해는 꼭 건강하게  ", lang: "ko", voterKey: vk("a"), ipHash: ip("a") });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.wish.body).toBe("올해는 꼭 건강하게");
        const list = await listSky(vk("a"));
        expect(list.items.find((w) => w.id === r.wish.id)).toMatchObject({ mine: true, cheers: 0 });
        expect(await createWish({ body: "시발 소원", lang: "ko", voterKey: vk("b"), ipHash: ip("b") })).toMatchObject({ ok: false, error: "banned" });
        expect(await createWish({ body: "https://spam.com 와서 봐", lang: "ko", voterKey: vk("b"), ipHash: ip("b") })).toMatchObject({ ok: false, error: "url" });
        expect(await createWish({ body: "가".repeat(61), lang: "ko", voterKey: vk("b"), ipHash: ip("b") })).toMatchObject({ ok: false, error: "too_long" });
        for (let i = 1; i < WISH_PER_DAY; i++) expect((await createWish({ body: `소원 ${i}`, lang: "ko", voterKey: vk("a"), ipHash: ip("a") })).ok).toBe(true);
        expect(await createWish({ body: "하나 더", lang: "ko", voterKey: vk("a"), ipHash: ip("a") })).toMatchObject({ ok: false, error: "limit" });
    });

    it("위기 낱말이 있는 소원은 하늘에 안 띄우고 안내를 보여 줌", async () => {
        const r = await createWish({ body: "죽고 싶다", lang: "ko", voterKey: vk("c"), ipHash: ip("c") });
        expect(r).toMatchObject({ ok: true, crisis: true });
        if (!r.ok) return;
        expect((await listSky()).items.some((w) => w.id === r.wish.id)).toBe(false);
    });

    it("빌어 줄게는 한 사람 한 번, 자기 소원엔 못 함. 신고 3곳이면 내려감", async () => {
        const r = await createWish({ body: "합격하게 해 주세요", lang: "ko", voterKey: vk("d"), ipHash: ip("d") });
        if (!r.ok) throw new Error("create failed");
        expect(await cheerWish(r.wish.id, vk("d"))).toMatchObject({ ok: false, error: "own" });
        expect(await cheerWish(r.wish.id, vk("e"))).toEqual({ ok: true, cheers: 1 });
        expect(await cheerWish(r.wish.id, vk("e"))).toMatchObject({ ok: false, error: "dup" });
        expect(await reportWish(r.wish.id, ip("r1"))).toEqual({ ok: true, hidden: false });
        expect(await reportWish(r.wish.id, ip("r1"))).toMatchObject({ ok: false, error: "dup" });
        await reportWish(r.wish.id, ip("r2"));
        expect(await reportWish(r.wish.id, ip("r3"))).toEqual({ ok: true, hidden: true });
        expect((await listSky()).items.some((w) => w.id === r.wish.id)).toBe(false);
    });

    it("풍등은 하루 지나면 채움 자리로만 남고(하늘이 비었을 때 뒤쪽), 고정한 것은 맨 앞", async () => {
        const r = await createWish({ body: "오래 남는 소원", lang: "ko", voterKey: vk("f"), ipHash: ip("f") });
        if (!r.ok) throw new Error("create failed");
        await prisma.wish.update({ where: { id: r.wish.id }, data: { created_at: new Date(Date.now() - 26 * 3600_000) } });
        const { memoClear } = await import("@/lib/cache");
        memoClear("wishes:");
        // 하루 안 소원·고정 소원보다 앞에 오지 않음 (하늘이 WISH_SKY_MIN 개보다 적을 때만 채움으로 뒤에)
        const since = Date.now() - WISH_SKY_HOURS * 3600_000;
        const alive = await prisma.wish.count({ where: { status: "public", OR: [{ pinned: true }, { created_at: { gte: new Date(since) } }] } });
        const sky0 = await listSky();
        const at0 = sky0.items.findIndex((w) => w.id === r.wish.id);
        if (alive >= WISH_SKY_MIN) expect(at0).toBe(-1);
        else expect(at0 === -1 || at0 >= alive).toBe(true);
        expect(await adminWishAction(r.wish.id, "pin")).toBe(true);
        const list = await listSky();
        expect(list.items[0]?.id).toBe(r.wish.id); // 고정은 맨 앞
        expect(await adminWishAction(r.wish.id, "unpin")).toBe(true);
        expect((await listSky()).items[0]?.id).not.toBe(r.wish.id);
    });
});
