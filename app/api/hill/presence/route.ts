import { json } from "@/lib/api";
import { getPresence } from "@/lib/hill";

// GET /api/hill/presence → 지금 하늘을 보고 있는 사람 수 (WebGL 없는 화면·SSR 용)
export async function GET() {
    return json({ ok: true, ...(await getPresence()) });
}
