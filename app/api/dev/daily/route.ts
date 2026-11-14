import { getCtx, err, json } from "@/lib/api";
import { getDailyStory, getFeaturedDue } from "@/lib/hill";
import { emitDaily } from "@/lib/realtime/emit";

// 개발용: 22:00 을 기다리지 않고 의식 연출 강제. /api/dev/daily | ?final=1 (이번 달 마감 발표) | ?id=12 (특정 이야기)
export async function GET(req: Request) {
    if (process.env.NODE_ENV === "production") return err("not_found", 404);
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const final = !!u.searchParams.get("final");
    const forced = parseInt(u.searchParams.get("id") || "", 10);
    let id: number | null = Number.isFinite(forced) ? forced : null;
    if (!id) {
        if (final) id = (await getFeaturedDue(ctx.lang, 365 * 24 * 3600 * 1000))?.story?.id ?? null;
        else id = (await getDailyStory(ctx.lang))?.id ?? null;
    }
    if (!id) return json({ ok: false, error: "no_story", hint: "공개 이야기가 없음. npm run db:seed" });
    emitDaily(id, final);
    return json({ ok: true, storyId: id, final });
}
