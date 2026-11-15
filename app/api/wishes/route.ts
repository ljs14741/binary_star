import { err, getCtx, json, readJson, sameOrigin } from "@/lib/api";
import { createWish, listTonight } from "@/lib/wishes";
import { isLang } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/ratelimit";

// GET /api/wishes → 오늘 밤 소원 (하늘에 뜨는 풍등)
export async function GET() {
    const ctx = await getCtx();
    return json({ ok: true, ...(await listTonight(ctx.voterKey)) });
}

// POST /api/wishes {body, lang} → 소원 빌기
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ body?: string; lang?: string }>(req);
    if (!data || typeof data.body !== "string") return err("bad_request");
    const ctx = await getCtx(data.lang);
    if (!rateLimit(`wish-ip:${ctx.ipHash}`, 6, 600_000)) return err("limit", 429);
    const r = await createWish({ body: data.body, lang: isLang(data.lang) ? data.lang : ctx.lang, voterKey: ctx.voterKey, ipHash: ctx.ipHash });
    if (!r.ok) return err(r.error, r.error === "limit" ? 429 : 400);
    return json({ ok: true, wish: r.wish, crisis: r.crisis });
}
