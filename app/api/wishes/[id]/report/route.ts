import { err, getCtx, json, sameOrigin } from "@/lib/api";
import { reportWish } from "@/lib/wishes";
import { rateLimit } from "@/lib/ratelimit";

// POST /api/wishes/:id/report → 신고 (같은 IP 대역은 소원당 한 번)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    if (!rateLimit(`wish-report:${ctx.ipHash}`, 10, 3600_000)) return err("limit", 429);
    const r = await reportWish(id, ctx.ipHash);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, hidden: r.hidden });
}
