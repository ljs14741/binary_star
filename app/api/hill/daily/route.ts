import { getCtx, err, json } from "@/lib/api";
import { getDailyStory, getFeaturedDue } from "@/lib/hill";

// 서버(server.ts)가 의식 시각에 부름. GET /api/hill/daily | ?final=check (마감 지났나) | ?final=1 (마감 1위)
export async function GET(req: Request) {
    if (req.headers.get("x-rt-secret") !== (process.env.STAR_SECRET || "star-dev-secret")) return err("forbidden", 403);
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const final = u.searchParams.get("final");
    if (final === "check") {
        const due = await getFeaturedDue(ctx.lang);
        return json({ ok: true, due: due?.due ?? null, story: due?.story ?? null });
    }
    if (final) {
        const due = await getFeaturedDue(ctx.lang, 365 * 24 * 3600 * 1000);
        return json({ ok: true, story: due?.story ?? null });
    }
    return json({ ok: true, story: await getDailyStory(ctx.lang) });
}
