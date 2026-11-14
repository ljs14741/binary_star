import { getCtx, err, json, sameOrigin } from "@/lib/api";
import { toggleEmpathy } from "@/lib/stories";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    const r = await toggleEmpathy(id, ctx.voterKey, ctx.geo, ctx.ownerTokenHash ?? undefined, ctx.ipHash);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : r.error === "limit" ? 429 : 403);
    return json({ ok: true, empathized: r.empathized, count: r.count });
}
