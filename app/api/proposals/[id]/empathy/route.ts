import { getCtx, err, json, sameOrigin } from "@/lib/api";
import { toggleProposalEmpathy } from "@/lib/proposals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    const r = await toggleProposalEmpathy(id, ctx.voterKey);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, empathized: r.empathized, count: r.count, promotedSlug: r.promotedSlug });
}
