import { err, json, readJson, sameOrigin } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { getLivePresence } from "@/lib/hill";

// POST /api/admin/live {key?} → 지금 언덕별 인원·나라·오늘 최고 동시 접속
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ key?: string }>(req);
    if (!(await isAdmin(data?.key))) return err("not_found", 404);
    return json({ ok: true, live: await getLivePresence() });
}
