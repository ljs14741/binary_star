import { err, json, readJson, sameOrigin } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { addDonation, deleteDonation, listAdminDonations } from "@/lib/donations";

// POST /api/admin/donation {key?, action: list|add|delete, ...} → 관리자 후원 내역 관리 (키 또는 로그인 쿠키)
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string; action?: string; name?: string; amount?: number; date?: string; id?: number }>(req);
    if (!(await isAdmin(data?.key))) return err("not_found", 404);
    if (data?.action === "list") return json({ ok: true, items: await listAdminDonations() });
    if (data?.action === "add") {
        const r = await addDonation({ name: data.name ?? "", amount: Number(data.amount), date: data.date ?? "" });
        if (!r.ok) return err(r.error, 400);
        return json({ ok: true, items: await listAdminDonations() });
    }
    if (data?.action === "delete" && Number.isFinite(Number(data.id))) {
        await deleteDonation(Number(data.id));
        return json({ ok: true, items: await listAdminDonations() });
    }
    return err("bad_request");
}
