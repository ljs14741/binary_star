// 방문자 키 계산 (next/headers 안 씀. 커스텀 서버·테스트에서도 사용)
import { hashWithSecret } from "./crypto";

export const VISITOR_COOKIE = "star_vid";

export function normalizeIp(ip: string): string {
    // IPv4 를 IPv6 로 감싼 "::ffff:1.2.3.4" 는 IPv4 로
    const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (m) return m[1];
    if (ip === "::1") return "127.0.0.1";
    return ip;
}

export function ipPrefixOf(raw: string): string {
    // IP 는 /24(IPv6 는 /64) 까지만 써서 같은 집에서 와이파이 바뀌는 정도는 같은 사람으로 봄
    const ip = normalizeIp(raw);
    return ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip.split(".").slice(0, 3).join(".");
}

export function makeVoterKey(visitorId: string, ip: string): string {
    return hashWithSecret("voter", visitorId, ipPrefixOf(ip));
}

// 쿠키를 바꿔 가며 누르는 거짓 공감을 막기 위한 IP 대역 해시 (원문 저장 안 함)
export function makeIpHash(ip: string): string {
    return hashWithSecret("ip", ipPrefixOf(ip));
}

// 요청 헤더에서 IP (Caddy 뒤에서는 x-forwarded-for)
export function ipFromHeaders(get: (name: string) => string | null | undefined, fallback = "127.0.0.1"): string {
    const fwd = get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return get("x-real-ip") || fallback || "127.0.0.1";
}

// 쿠키 문자열에서 값 하나
export function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
        const [k, ...rest] = part.trim().split("=");
        if (k === name) return decodeURIComponent(rest.join("="));
    }
    return null;
}
