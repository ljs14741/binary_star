import { getCtx, err, json, parseIdList, readJson, sameOrigin } from "@/lib/api";
import { createStory, getFeed } from "@/lib/stories";
import { isLang } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/ratelimit";

// GET /api/stories?room=slug&lang=ko&first=12&exclude=1,2&seen=3,4&limit=8
export async function GET(req: Request) {
    const u = new URL(req.url);
    const ctx = await getCtx(u.searchParams.get("lang"));
    const first = parseInt(u.searchParams.get("first") || "", 10);
    const feed = await getFeed({
        roomSlug: u.searchParams.get("room") || undefined,
        lang: ctx.lang,
        firstId: Number.isFinite(first) ? first : undefined,
        exclude: parseIdList(u.searchParams.get("exclude")),
        seen: parseIdList(u.searchParams.get("seen")),
        limit: parseInt(u.searchParams.get("limit") || "8", 10) || 8,
        voterKey: ctx.voterKey,
        ownerTokenHash: ctx.ownerTokenHash ?? undefined,
    });
    return json({ ok: true, ...feed });
}

type Body = { room: string; body: string; nickname?: string | null; ageGroup?: string | null; lang?: string};

// POST /api/stories
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const data = await readJson<Body>(req);
    if (!data || typeof data.body !== "string" || typeof data.room !== "string") return err("bad_request");
    const ctx = await getCtx(data.lang);
    // 쿠키를 지워도 같은 IP 대역은 한 시간에 15편까지 (도배 방지)
    if (!rateLimit(`story-ip:${ctx.ipHash}`, 15, 3600_000)) return err("limit", 429);
    // 글 언어 = 쓴 사람이 보고 있던 화면 언어. 한국어 화면에서 영어로 써도 한국어 독자에게 보임 (글자 추정은 번역 켤 때 원문 힌트로만)
    const lang = isLang(data.lang) ? data.lang : ctx.lang;
    const r = await createStory({
        roomSlug: data.room,
        body: data.body,
        nickname: typeof data.nickname === "string" ? data.nickname : null,
        ageGroup: data.ageGroup ?? null,
        lang,
        voterKey: ctx.voterKey,
        ownerToken: ctx.ownerToken,
        geo: ctx.geo,
    });
    if (!r.ok) return err(r.error, r.error === "limit" ? 429 : 400);
    return json({ ok: true, story: r.story, ownerToken: r.ownerToken, masked: r.masked, crisis: r.crisis });
}
