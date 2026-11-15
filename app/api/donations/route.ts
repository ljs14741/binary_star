import { json } from "@/lib/api";
import { listPublicDonations } from "@/lib/donations";

// GET /api/donations → 후원해 주신 분들 (이름 가림)
export async function GET() {
    return json({ ok: true, ...(await listPublicDonations()) });
}
