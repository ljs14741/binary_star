import { getCtx, err, json, readJson, sameOrigin } from "@/lib/api";
import { createProposal, listProposals } from "@/lib/proposals";
import { PROPOSAL_THRESHOLD } from "@/lib/site";
import { rateLimit } from "@/lib/ratelimit";

export async function GET() {
    const ctx = await getCtx();
    return json({ ok: true, proposals: await listProposals(ctx.voterKey), threshold: PROPOSAL_THRESHOLD });
}

export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ title?: string; lang?: string }>(req);
    if (!data || typeof data.title !== "string") return err("bad_request");
    const ctx = await getCtx(data.lang);
    if (!rateLimit(`proposal-ip:${ctx.ipHash}`, 5, 3600_000)) return err("limit", 429);
    const r = await createProposal(data.title, ctx.lang, ctx.voterKey, ctx.geo);
    if (!r.ok) return err(r.error, r.error === "limit" ? 429 : r.error === "dup" ? 409 : 400);
    return json({ ok: true, proposal: r.proposal });
}
