import { describe, expect, it } from "vitest";
import { getDict, t, LANGS } from "@/lib/i18n";
import { pickLang, detectLangByScript } from "@/lib/i18n/config";
import { ko } from "@/messages/ko";

describe("언어", () => {
    it("4개 언어 사전의 키가 전부 같음", () => {
        const keys = Object.keys(ko).sort();
        for (const l of LANGS) {
            const d = getDict(l);
            expect(Object.keys(d).sort()).toEqual(keys);
            for (const k of keys) expect((d as Record<string, string>)[k].length, `${l}.${k}`).toBeGreaterThan(0);
        }
    });
    it("{n} 자리 채움", () => {
        expect(t("ko", "room_story_count", { n: 3 })).toBe("이야기 3개");
        expect(t("en", "room_story_count", { n: 3 })).toBe("3 stories");
        expect(t("ja", "story_countries", { n: 2 })).toContain("2");
        expect(t("zh-TW", "me_new", { n: 412 })).toContain("412");
    });
    it("Accept-Language 로 언어 고름", () => {
        expect(pickLang("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
        expect(pickLang("ja")).toBe("ja");
        expect(pickLang("zh-TW,zh;q=0.9")).toBe("zh-TW");
        expect(pickLang("zh-CN")).toBe("zh-TW");
        expect(pickLang("en-US")).toBe("en");
        expect(pickLang("fr-FR")).toBe("ko");
        expect(pickLang(null)).toBe("ko");
    });
    it("글자 종류로 언어 추정", () => {
        expect(detectLangByScript("스무 살의 나에게", "en")).toBe("ko");
        expect(detectLangByScript("二十歳の自分へ、ありがとう", "en")).toBe("ja");
        expect(detectLangByScript("給二十歲的自己", "en")).toBe("zh-TW");
        expect(detectLangByScript("To my younger self", "ko")).toBe("en");
        expect(detectLangByScript("!!! 123", "ja")).toBe("ja");
    });
});
