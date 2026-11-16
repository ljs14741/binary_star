import { err, getCtx, json, readJson, sameOrigin } from "@/lib/api";
import { createGuestbook, listGuestbook } from "@/lib/guestbook";
import { isLang } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/ratelimit";

// GET /api/guestbook?before=id → 방명록 (최신순 30개씩)
export async function GET(req: Request) {
    const before = parseInt(new URL(req.url).searchParams.get("before") ?? "", 10);
    const ctx = await getCtx();
    return json({ ok: true, ...(await listGuestbook({ before: Number.isFinite(before) ? before : null, voterKey: ctx.voterKey })) });
}

// POST /api/guestbook {body, nickname, lang} → 한마디 남기기
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<{ body?: string; nickname?: string | null; lang?: string }>(req);
    if (!data || typeof data.body !== "string") return err("bad_request");
    const ctx = await getCtx(data.lang);
    if (!rateLimit(`guestbook-ip:${ctx.ipHash}`, 6, 600_000)) return err("limit", 429);
    const r = await createGuestbook({
        body: data.body,
        nickname: typeof data.nickname === "string" ? data.nickname : null,
        lang: isLang(data.lang) ? data.lang : ctx.lang,
        country: ctx.geo.country,
        voterKey: ctx.voterKey,
        ipHash: ctx.ipHash,
    });
    if (!r.ok) return err(r.error, r.error === "limit" ? 429 : 400);
    return json({ ok: true, entry: r.entry, crisis: r.crisis });
}
