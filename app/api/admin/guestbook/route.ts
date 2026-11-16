import { err, json, readJson, sameOrigin } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { adminGuestbookAction, listAdminGuestbook } from "@/lib/guestbook";

// POST /api/admin/guestbook {key?, action: list|hide|unhide|remove|reply, id?, reply?} → 관리자 방명록 관리
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string; action?: string; id?: number; reply?: string }>(req);
    if (!(await isAdmin(data?.key))) return err("not_found", 404);
    const a = data?.action;
    if (a === "hide" || a === "unhide" || a === "remove" || a === "reply") {
        if (!Number.isFinite(Number(data?.id))) return err("bad_request");
        await adminGuestbookAction(Number(data!.id), a, data?.reply);
    } else if (a !== "list") return err("bad_request");
    return json({ ok: true, items: await listAdminGuestbook() });
}
