import { getCtx, json } from "@/lib/api";

// GET /api/geo → 서버가 추정한 나라·지역 (쓰기 화면의 지역 칩 초기값)
export async function GET() {
    const ctx = await getCtx();
    return json({ ok: true, country: ctx.geo.country, city: ctx.geo.city });
}
