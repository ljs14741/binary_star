import { Prisma } from "@prisma/client";
import { getCtx, err, json, sameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/kst";

// POST /api/visit → 오늘 방문자로 1번 기록 (쿠키+IP 해시 기준 유니크). 브라우저 세션마다 한 번 보냄
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const ctx = await getCtx();
    try {
        await prisma.visit_day.create({ data: { day: kstDay(), voter_key: ctx.voterKey, lang: ctx.lang } });
    } catch (e) {
        // 같은 날 같은 사람이면 이미 있음 → 무시
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    return json({ ok: true });
}
