"use client";
// 브라우저 저장소: owner 토큰, 본 이야기, 마지막 공감 합계. 전부 try/catch (시크릿 모드 대비)
import type { Lang } from "./i18n/config";

const KEY_OWNER = "star_owner";
const KEY_SEEN = "star_seen";
const KEY_LAST_TOTAL = "star_last_total";
const KEY_MINE = "star_mine_ids";
const KEY_NICK = "star_nickname"; // 원문 문자열 (JSON 아님, 예전 값과 호환)
const KEY_NICK_V2 = "star_nickname_v2"; // 자동 별명 도입 뒤 한 번 정해졌는지
export const NICK_EVENT = "star:nickname";

function read<T>(k: string, fallback: T): T {
    try {
        const v = localStorage.getItem(k);
        return v ? (JSON.parse(v) as T) : fallback;
    } catch {
        return fallback;
    }
}
function write(k: string, v: unknown) {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch {
        /* 무시 */
    }
}

export function getOwnerToken(): string | null {
    return read<string | null>(KEY_OWNER, null);
}
// 같은 탭엔 storage 이벤트가 안 와서 직접 알림 (헤더 '내 이야기' 링크 즉시 표시용)
export const OWNER_EVENT = "star:owner";
export function setOwnerToken(t: string) {
    write(KEY_OWNER, t);
    try {
        window.dispatchEvent(new Event(OWNER_EVENT));
    } catch {}
}

export function getSeen(): number[] {
    return read<number[]>(KEY_SEEN, []);
}
export function addSeen(ids: number[]) {
    const cur = getSeen();
    const set = new Set([...cur, ...ids]);
    write(KEY_SEEN, [...set].slice(-300));
}

export function getLastTotal(token: string): number | null {
    const m = read<Record<string, number>>(KEY_LAST_TOTAL, {});
    return m[token] ?? null;
}
export function setLastTotal(token: string, total: number) {
    const m = read<Record<string, number>>(KEY_LAST_TOTAL, {});
    m[token] = total;
    write(KEY_LAST_TOTAL, m);
}

export function getMineIds(): number[] {
    return read<number[]>(KEY_MINE, []);
}
export function addMineId(id: number) {
    write(KEY_MINE, [...new Set([...getMineIds(), id])].slice(-200));
}

// API 호출. owner 토큰은 헤더로 같이 보냄 (내 글 공감 막기·내 글 표시)
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T & { ok: boolean; error?: string }> {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    const owner = getOwnerToken();
    if (owner) headers["x-star-owner"] = owner;
    let body = init?.body;
    if (init?.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.json);
    }
    const res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
    try {
        return (await res.json()) as T & { ok: boolean; error?: string };
    } catch {
        return { ok: false, error: `http_${res.status}` } as T & { ok: boolean; error?: string };
    }
}

export function langPath(lang: Lang, path = ""): string {
    return `/${lang}${path.startsWith("/") ? path : path ? `/${path}` : ""}`;
}

export function siteOrigin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";
}

// ---------- 별명 ----------
export function getNickname(): string {
    try {
        return localStorage.getItem(KEY_NICK) ?? "";
    } catch {
        return "";
    }
}
export function setNickname(v: string) {
    try {
        localStorage.setItem(KEY_NICK, v.trim());
        localStorage.setItem(KEY_NICK_V2, "1");
        window.dispatchEvent(new Event(NICK_EVENT));
    } catch {
        /* 무시 */
    }
}
// 처음이거나(자동 별명 도입 전에 비워 둔 사람 포함) 비어 있으면 하나 정해 줌. 그 뒤 일부러 지운 건 존중
export function ensureNickname(make: () => string): string {
    try {
        const cur = localStorage.getItem(KEY_NICK) ?? "";
        if (localStorage.getItem(KEY_NICK_V2) || cur) {
            if (!localStorage.getItem(KEY_NICK_V2)) localStorage.setItem(KEY_NICK_V2, "1");
            return cur;
        }
        const n = make();
        setNickname(n);
        return n;
    } catch {
        return "";
    }
}
