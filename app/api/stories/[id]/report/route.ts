import { getCtx, err, json, readJson, sameOrigin } from "@/lib/api";
import { reportStory } from "@/lib/stories";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const data = await readJson<{ reason?: string }>(req);
    const ctx = await getCtx();
    const r = await reportStory(id, ctx.voterKey, data?.reason || "other");
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, reportCount: r.reportCount, hidden: r.hidden });
}
