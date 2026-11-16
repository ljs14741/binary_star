import { err, getCtx, json, sameOrigin } from "@/lib/api";
import { reportGuestbook } from "@/lib/guestbook";
import { rateLimit } from "@/lib/ratelimit";

// POST /api/guestbook/:id/report → 신고 (같은 IP 대역은 글마다 한 번)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    if (!rateLimit(`guestbook-report:${ctx.ipHash}`, 10, 3600_000)) return err("limit", 429);
    const r = await reportGuestbook(id, ctx.ipHash);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, hidden: r.hidden });
}
