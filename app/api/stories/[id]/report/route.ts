import { getCtx, err, json, readJson, sameOrigin } from "@/lib/api";
import { reportStory } from "@/lib/stories";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const data = await readJson<{ reason?: string }>(req);
    const ctx = await getCtx();
    // 쿠키를 바꿔 가며 혼자 여러 번 신고해 글을 숨기지 못하게: 같은 IP 대역은 이야기당 하루 1번, 한 시간 10번
    if (!rateLimit(`report-ip:${ctx.ipHash}:${id}`, 1, 24 * 3600_000)) return err("dup", 409);
    if (!rateLimit(`report-ip:${ctx.ipHash}`, 10, 3600_000)) return err("limit", 429);
    const r = await reportStory(id, ctx.voterKey, data?.reason || "other");
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : 409);
    return json({ ok: true, reportCount: r.reportCount, hidden: r.hidden });
}
