import { describe, expect, it } from "vitest";
import { applyRegion, KR_REGIONS, pickPlace, placeName } from "@/lib/place";

describe("지역 이름", () => {
    it("한국은 동 대신 시도, 괄호 상세는 버림", () => {
        expect(pickPlace("KR", "Yongsan-dong (Hangang-daero)", "Seoul")).toBe("Seoul");
        expect(pickPlace("KR", "Seongnam-si", "Gyeonggi-do")).toBe("Gyeonggi-do");
        expect(pickPlace("JP", "Minato", "Tokyo")).toBe("Tokyo");
        expect(pickPlace("TW", "Taipei", "Taiwan")).toBe("Taipei");
        expect(pickPlace("US", "Mountain View (x)", "California")).toBe("Mountain View");
        expect(pickPlace("KR", null, null)).toBeNull();
    });
    it("보는 언어로 바꿈, 모르면 영문 그대로", () => {
        expect(placeName("Seoul", "KR", "ko")).toBe("서울");
        expect(placeName("Gyeonggi-do", "KR", "ko")).toBe("경기");
        expect(placeName("North Chungcheong", "KR", "ko")).toBe("충북");
        expect(placeName("Seoul", "KR", "ja")).toBe("ソウル");
        expect(placeName("Seoul", "KR", "en")).toBe("Seoul");
        expect(placeName("Tokyo", "JP", "ko")).toBe("도쿄");
        expect(placeName("Mountain View", "US", "ko")).toBe("Mountain View");
        expect(placeName(null, "KR", "ko")).toBeNull();
    });
    it("고른 지역이 추정을 덮고, 빈 값은 숨김, 모르는 값은 무시", () => {
        const est = { country: "KR", city: "Seoul", lat: 37.6, lng: 127.0 };
        expect(applyRegion(est, "Gyeonggi-do")).toMatchObject({ country: "KR", city: "Gyeonggi-do" });
        expect(applyRegion(est, "")).toMatchObject({ city: null });
        expect(applyRegion(est, "Mars")).toEqual(est);
        expect(applyRegion(est, undefined)).toEqual(est);
        expect(KR_REGIONS).toHaveLength(17);
        for (const r of KR_REGIONS) expect(placeName(r.key, "KR", "ko")).not.toBe(r.key);
    });
});
