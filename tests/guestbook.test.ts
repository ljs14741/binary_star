import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { adminGuestbookAction, createGuestbook, GUESTBOOK_PER_DAY, listGuestbook, reportGuestbook } from "@/lib/guestbook";

const vk = (n: string) => `test-gb-${n}-`.padEnd(64, "x");
const ip = (n: string) => `test-gb-ip-${n}`;
const base = (n: string) => ({ lang: "ko" as const, country: "KR", voterKey: vk(n), ipHash: ip(n) });

afterAll(async () => {
    await prisma.guestbook.deleteMany({ where: { voter_key: { startsWith: "test-gb-" } } });
    await prisma.$disconnect();
});

describe("방명록", () => {
    it("남기면 목록 맨 위에, 별명·시간이 붙고 금칙어·링크는 막힘, 하루 5번까지", async () => {
        const r = await createGuestbook({ body: "  예쁜 사이트네요\n잘 보고 가요  ", nickname: "지나가는 별", ...base("a") });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.entry).toMatchObject({ body: "예쁜 사이트네요\n잘 보고 가요", nickname: "지나가는 별", country: "KR", mine: true });
        expect(Date.parse(r.entry.at)).toBeGreaterThan(Date.now() - 60_000);
        expect((await listGuestbook({ voterKey: vk("a") })).items[0]).toMatchObject({ id: r.entry.id, mine: true });
        expect(await createGuestbook({ body: "시발 별로", ...base("b") })).toMatchObject({ ok: false, error: "banned" });
        expect(await createGuestbook({ body: "토토사이트 추천", ...base("b") })).toMatchObject({ ok: false, error: "banned" });
        expect(await createGuestbook({ body: "https://spam.com", ...base("b") })).toMatchObject({ ok: false, error: "url" });
        for (let i = 1; i < GUESTBOOK_PER_DAY; i++) expect((await createGuestbook({ body: `또 왔어요 ${i}`, ...base("a") })).ok).toBe(true);
        expect(await createGuestbook({ body: "하나 더", ...base("a") })).toMatchObject({ ok: false, error: "limit" });
    });

    it("위기 낱말은 공개 안 함", async () => {
        const r = await createGuestbook({ body: "요즘 죽고 싶다", ...base("c") });
        expect(r).toMatchObject({ ok: true, crisis: true });
        if (!r.ok) return;
        expect((await listGuestbook()).items.some((e) => e.id === r.entry.id)).toBe(false);
    });

    it("신고 3곳이면 숨김, 운영자 답글은 목록에 같이 나옴", async () => {
        const r = await createGuestbook({ body: "건의: 밤 말고 낮도 있으면 좋겠어요", ...base("d") });
        if (!r.ok) throw new Error("create failed");
        expect(await adminGuestbookAction(r.entry.id, "reply", "좋은 생각이에요, 고민해 볼게요")).toBe(true);
        const shown = (await listGuestbook()).items.find((e) => e.id === r.entry.id);
        expect(shown?.reply).toBe("좋은 생각이에요, 고민해 볼게요");
        expect(shown?.replyAt).toBeTruthy();
        expect(await reportGuestbook(r.entry.id, ip("r1"))).toEqual({ ok: true, hidden: false });
        expect(await reportGuestbook(r.entry.id, ip("r1"))).toMatchObject({ ok: false, error: "dup" });
        await reportGuestbook(r.entry.id, ip("r2"));
        expect(await reportGuestbook(r.entry.id, ip("r3"))).toEqual({ ok: true, hidden: true });
        expect((await listGuestbook()).items.some((e) => e.id === r.entry.id)).toBe(false);
    });
});
