import { describe, expect, it } from "vitest";
import { makeVoterKey } from "@/lib/voter";
import { hashOwnerToken, newOwnerToken } from "@/lib/crypto";
import { parseDevGeo, countryFromAcceptLanguage } from "@/lib/geo";

describe("가입 없이 사람 구분", () => {
    it("쿠키+IP 해시, IP 원문 없음", () => {
        const k = makeVoterKey("cookie-abc", "1.2.3.4");
        expect(k).toHaveLength(64);
        expect(k).not.toContain("1.2.3.4");
        expect(makeVoterKey("cookie-abc", "1.2.3.9")).toBe(k); // 같은 /24
        expect(makeVoterKey("cookie-abc", "1.2.4.4")).not.toBe(k);
        expect(makeVoterKey("cookie-xyz", "1.2.3.4")).not.toBe(k);
    });
    it("owner 토큰은 32바이트, DB 엔 해시만", () => {
        const tkn = newOwnerToken();
        expect(Buffer.from(tkn, "base64url")).toHaveLength(32);
        expect(hashOwnerToken(tkn)).toHaveLength(64);
        expect(hashOwnerToken(tkn)).toBe(hashOwnerToken(tkn));
    });
    it("위치 폴백", () => {
        expect(parseDevGeo("JP,Tokyo,35.7,139.7")).toEqual({ country: "JP", city: "Tokyo", lat: 35.7, lng: 139.7 });
        expect(countryFromAcceptLanguage("ko-KR,ko;q=0.9")).toBe("KR");
        expect(countryFromAcceptLanguage("ja")).toBe("JP");
        expect(countryFromAcceptLanguage(null)).toBeNull();
    });
});
