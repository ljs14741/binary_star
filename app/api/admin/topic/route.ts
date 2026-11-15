import { err, json, readJson, sameOrigin } from "@/lib/api";
import { adminKeyOk, swapTopic } from "@/lib/admin";

// POST /api/admin/topic {key, proposalId, closeRoomId?} → 제안을 주제로 올리고(필요하면) 조용한 주제를 내림
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string; proposalId?: number; closeRoomId?: number | null }>(req);
    if (!adminKeyOk(data?.key)) return err("not_found", 404);
    const proposalId = Number(data?.proposalId);
    const closeRoomId = data?.closeRoomId == null ? null : Number(data.closeRoomId);
    if (!Number.isFinite(proposalId) || (closeRoomId != null && !Number.isFinite(closeRoomId))) return err("bad_request");
    const r = await swapTopic(proposalId, closeRoomId);
    if (!r.ok) return err(r.error, 409);
    return json({ ok: true, slug: r.slug });
}
