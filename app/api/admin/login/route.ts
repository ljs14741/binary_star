import { NextResponse } from "next/server";
import { err, getCtx, readJson, sameOrigin } from "@/lib/api";
import { ADMIN_COOKIE, ADMIN_COOKIE_DAYS, adminCookieValue, adminKeyOk } from "@/lib/admin";
import { rateLimit } from "@/lib/ratelimit";

// POST /api/admin/login {key} → 맞으면 로그인 쿠키(90일). 같은 IP 대역은 한 시간 10번까지만 시도
export async function POST(req: Request) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const ctx = await getCtx();
    if (!rateLimit(`admin-login:${ctx.ipHash}`, 10, 3600_000)) return err("limit", 429);
    const data = await readJson<{ key?: string }>(req);
    if (!adminKeyOk(data?.key?.trim())) return err("wrong", 401);
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set(ADMIN_COOKIE, adminCookieValue()!, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: ADMIN_COOKIE_DAYS * 24 * 3600 });
    return res;
}
