import { err, json, readJson, sameOrigin } from "@/lib/api";
import { isAdmin, adminStoryAction, type AdminAction } from "@/lib/admin";

// POST /api/admin/story {key, id, action: hide|unhide|remove} → 운영자 조치
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string; id?: number; action?: AdminAction }>(req);
    if (!(await isAdmin(data?.key))) return err("not_found", 404);
    const id = Number(data?.id);
    const action = data?.action;
    if (!Number.isFinite(id) || !action || !["hide", "unhide", "remove"].includes(action)) return err("bad_request");
    const ok = await adminStoryAction(id, action);
    if (!ok) return err("not_found", 404);
    return json({ ok: true });
}
