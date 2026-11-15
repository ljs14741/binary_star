import { err, json, readJson, sameOrigin } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { adminWishAction, listAdminWishes } from "@/lib/wishes";

// POST /api/admin/wish {key?, action: list|hide|unhide|remove|pin|unpin, id?} → 관리자 소원 관리
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string; action?: string; id?: number }>(req);
    if (!(await isAdmin(data?.key))) return err("not_found", 404);
    const a = data?.action;
    if (a === "hide" || a === "unhide" || a === "remove" || a === "pin" || a === "unpin") {
        if (!Number.isFinite(Number(data?.id))) return err("bad_request");
        await adminWishAction(Number(data!.id), a);
    } else if (a !== "list") return err("bad_request");
    return json({ ok: true, items: await listAdminWishes() });
}
