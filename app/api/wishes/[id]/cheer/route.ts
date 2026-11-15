import { err, getCtx, json, sameOrigin } from "@/lib/api";
import { cheerWish } from "@/lib/wishes";
import { rateLimit } from "@/lib/ratelimit";

// POST /api/wishes/:id/cheer → 빌어 줄게 (한 번)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    if (!rateLimit(`wish-cheer:${ctx.ipHash}`, 40, 60_000)) return err("limit", 429);
    const r = await cheerWish(id, ctx.voterKey);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, cheers: r.cheers });
}
