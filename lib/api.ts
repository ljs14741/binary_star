// API 라우트 공통: 방문자 키·위치·언어·owner 토큰 해시
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, getVoterKey, makeIpHash } from "./voter";
import { lookupGeo, type Geo } from "./geo";
import { hashOwnerToken } from "./crypto";
import { isLang, pickLang, type Lang } from "./i18n/config";

export type Ctx = { voterKey: string; ipHash: string; geo: Geo; lang: Lang; ownerTokenHash: string | null; ownerToken: string | null };

export async function getCtx(langParam?: string | null): Promise<Ctx> {
    const h = await headers();
    const c = await cookies();
    const [voterKey, ip] = await Promise.all([getVoterKey(), getClientIp()]);
    const devGeo = process.env.NODE_ENV !== "production" ? c.get("star_dev_geo")?.value ?? null : null;
    const geo = await lookupGeo(ip, h.get("accept-language"), devGeo);
    const lang: Lang = isLang(langParam) ? langParam : isLang(c.get("star_lang")?.value) ? (c.get("star_lang")!.value as Lang) : pickLang(h.get("accept-language"));
    const ownerToken = h.get("x-star-owner");
    return { voterKey, ipHash: makeIpHash(ip), geo, lang, ownerTokenHash: ownerToken ? hashOwnerToken(ownerToken) : null, ownerToken: ownerToken || null };
}

export function json(data: unknown, status = 200) {
    return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function err(error: string, status = 400) {
    return json({ ok: false, error }, status);
}

export function parseIdList(v: string | null): number[] {
    if (!v) return [];
    return v
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 300);
}

export async function readJson<T>(req: Request): Promise<T | null> {
    try {
        return (await req.json()) as T;
    } catch {
        return null;
    }
}

// 쓰기 요청은 우리 사이트에서 온 것만 (다른 사이트에 심은 스크립트로 공감 누르기 방지). 헤더 없는 요청은 통과
export function sameOrigin(req: Request): boolean {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
        try {
            if (new URL(origin).host !== host) return false;
        } catch {
            return false;
        }
    }
    return true;
}
