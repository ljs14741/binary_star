import { getCtx, err, json } from "@/lib/api";
import { getPublicStory } from "@/lib/stories";

// GET /api/stories/{id}/view?lang=ko → 공개 이야기 하나 (언덕에서 별을 눌렀을 때)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const story = await getPublicStory(id, ctx.lang, ctx.voterKey, ctx.ownerTokenHash ?? undefined);
    if (!story) return err("not_found", 404);
    return json({ ok: true, story });
}
