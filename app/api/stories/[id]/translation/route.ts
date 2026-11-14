import { getCtx, err, json } from "@/lib/api";
import { getTranslation } from "@/lib/translate";

// GET /api/stories/:id/translation?lang=en → 번역본 (없고 키 있으면 만들어서 캐시)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const t = await getTranslation(id, ctx.lang);
    return json({ ok: true, translation: t });
}
