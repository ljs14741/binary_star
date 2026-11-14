import { getCtx, err, json } from "@/lib/api";
import { getMine } from "@/lib/stories";
import { hashOwnerToken } from "@/lib/crypto";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    if (!token || token.length < 32) return err("bad_request");
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const mine = await getMine(hashOwnerToken(token), ctx.lang);
    return json({ ok: true, ...mine });
}
