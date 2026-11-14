import { getCtx, json } from "@/lib/api";
import { getSky } from "@/lib/hill";

// GET /api/hill/stars?lang=ko → 하늘의 별(이야기) 목록 + 방 구역
export async function GET(req: Request) {
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const sky = await getSky(ctx.lang);
    return json({ ok: true, ...sky });
}
