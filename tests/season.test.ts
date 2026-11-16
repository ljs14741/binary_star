import { describe, expect, it } from "vitest";
import { isSnowSeason, moonIllumination, moonPhase } from "@/components/hill/season";

describe("달 모양·계절", () => {
    it("알려진 삭·보름과 맞음", () => {
        // 2024-01-11 11:57 UTC 삭, 2024-01-25 17:54 UTC 보름
        const nm = moonPhase(new Date(Date.UTC(2024, 0, 11, 11, 57)));
        expect(Math.min(nm, 1 - nm)).toBeLessThan(0.02);
        expect(Math.abs(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))) - 0.5)).toBeLessThan(0.02);
        expect(moonIllumination(0)).toBeCloseTo(0);
        expect(moonIllumination(0.5)).toBeCloseTo(1);
    });
    it("눈은 한국 시간 12~2월", () => {
        expect(isSnowSeason(new Date("2026-12-01T00:30:00+09:00"))).toBe(true);
        expect(isSnowSeason(new Date("2026-11-30T23:30:00+09:00"))).toBe(false);
        expect(isSnowSeason(new Date("2027-02-28T12:00:00+09:00"))).toBe(true);
        expect(isSnowSeason(new Date("2027-03-01T00:10:00+09:00"))).toBe(false);
    });
});
