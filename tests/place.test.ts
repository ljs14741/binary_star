import { describe, expect, it } from "vitest";
import { pickPlace } from "@/lib/place";

describe("지역 이름", () => {
    it("한국·일본은 동 대신 시도, 괄호 상세는 버림", () => {
        expect(pickPlace("KR", "Yongsan-dong (Hangang-daero)", "Seoul")).toBe("Seoul");
        expect(pickPlace("KR", "Seongnam-si", "Gyeonggi-do")).toBe("Gyeonggi-do");
        expect(pickPlace("JP", "Minato", "Tokyo")).toBe("Tokyo");
        expect(pickPlace("TW", "Taipei", "Taiwan")).toBe("Taipei");
        expect(pickPlace("US", "Mountain View (x)", "California")).toBe("Mountain View");
        expect(pickPlace("KR", null, null)).toBeNull();
    });
});
