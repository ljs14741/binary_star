// 가입 없이 사람을 구분하는 키. 쿠키 무작위 id + IP 를 섞어 해시. IP 원문은 어디에도 저장 안 함
import { cookies, headers } from "next/headers";
import { newVisitorId } from "./crypto";
import { ipFromHeaders, makeIpHash, makeVoterKey, VISITOR_COOKIE } from "./voter-core";

export { VISITOR_COOKIE, makeVoterKey, makeIpHash };

export async function getClientIp(): Promise<string> {
    const h = await headers();
    return ipFromHeaders((n) => h.get(n));
}

// 쿠키가 없으면 새로 발급 (API 라우트에서 호출 → 응답에 Set-Cookie 됨)
export async function getVisitorId(): Promise<string> {
    const c = await cookies();
    const existing = c.get(VISITOR_COOKIE)?.value;
    if (existing && existing.length >= 16) return existing;
    const id = newVisitorId();
    try {
        c.set(VISITOR_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 400, path: "/" });
    } catch {
        // 서버 컴포넌트에서 호출되면 set 이 안 됨 → proxy 가 발급해 주니 무시
    }
    return id;
}

export async function getIpHash(): Promise<string> {
    return makeIpHash(await getClientIp());
}

export async function getVoterKey(): Promise<string> {
    const [vid, ip] = await Promise.all([getVisitorId(), getClientIp()]);
    return makeVoterKey(vid, ip);
}
