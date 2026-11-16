import { describe, expect, it } from "vitest";
import { moderate, maskPii, hasBannedWord, hasCrisisWord, hasUrl } from "@/lib/moderation";

describe("기본 검수", () => {
    it("빈 글·긴 글", () => {
        expect(moderate("   ").reason).toBe("empty");
        expect(moderate("가".repeat(2001)).reason).toBe("too_long");
        expect(moderate("가".repeat(2000)).ok).toBe(true);
    });
    it("링크 금지 (이메일 도메인은 링크로 안 봄)", () => {
        expect(moderate("놀러와 https://example.com").reason).toBe("url");
        expect(moderate("naver.com 검색해봐").reason).toBe("url");
        expect(moderate("메일은 me@example.com").ok).toBe(true);
        expect(hasUrl("그냥 평범한 문장. 끝.")).toBe(false);
    });
    it("금칙어 4개 언어 + 우회", () => {
        expect(hasBannedWord("이 병신아")).toBe(true);
        expect(hasBannedWord("시.발 진짜")).toBe(true);
        expect(hasBannedWord("you are a fucking idiot")).toBe(true);
        expect(hasBannedWord("お前なんか死ね")).toBe(true);
        expect(hasBannedWord("你這個白痴智障")).toBe(true);
        expect(hasBannedWord("그때 정말 고마웠어")).toBe(false);
        expect(hasBannedWord("I miss you so much")).toBe(false);
        expect(moderate("이 병신아").reason).toBe("banned");
        for (const w of ["ㅅ ㅂ", "시 발 진짜", "씨1발", "병a신아", "씹새끼", "お前ブスだな"]) expect(hasBannedWord(w), w).toBe(true);
    });
    it("평범한 말은 안 막음", () => {
        for (const w of ["관계의 시발점", "시발역에서 탔다", "그 말을 곱씹어 봤어", "꼭꼭 씹어 먹어", "필요 시 발급받으면 돼", "도착 시 발견했어", "우리 집 개 새로 왔어", "시바견", "씨바스 리갈", "ブスケッツのファン", "デブリーフィング", "廢物利用", "학자금 대출 갚느라", "토토가 보고 싶어", "카지노 갔다가 다 잃었던 아빠", "먹튀 당했어 친구한테", "오피스텔로 이사", "2024년 10대"]) expect(hasBannedWord(w), w).toBe(false);
    });
    it("도박·성매매 광고", () => {
        for (const w of ["토토 사이트 가입", "토1토사이트", "온라인 카지노", "바카라 무료체험", "먹튀검증 완료", "조건만남 하실분", "출장 안마", "텔레그램 문의", "online casino bonus", "オンラインカジノ", "線上娛樂城", "外送茶"]) expect(hasBannedWord(w), w).toBe(true);
    });
    it("개인정보 가림", () => {
        const r = maskPii("010-1234-5678 / 01012345678 / +82 10 1234 5678 / 900101-1234567 / 110-123-456789 / a.b@c.co.kr / 카톡 아이디 abcd1234");
        expect(r.masked).toBe(true);
        expect(r.body).not.toMatch(/1234-5678|01012345678|900101|456789|a\.b@c/);
        expect(r.body).not.toMatch(/abcd1234/);
        // 연도·금액·짧은 숫자는 안 건드림
        expect(maskPii("2024년 11월 12일, 3,201개 공감, 20살").masked).toBe(false);
        // 영어 낱말 안쪽은 메신저 이름으로 안 봄
        for (const w of ["I met him online yesterday", "deadline extended", "administrator said no", "instantly happy"]) expect(maskPii(w).masked, w).toBe(false);
    });
    it("위험 낱말 → 비공개 (일상 표현은 통과)", () => {
        expect(hasCrisisWord("요즘 죽고 싶다는 생각이 들어")).toBe(true);
        expect(hasCrisisWord("I want to die sometimes")).toBe(true);
        expect(hasCrisisWord("もう死にたい")).toBe(true);
        expect(hasCrisisWord("我不想活了")).toBe(true);
        expect(hasCrisisWord("아버지가 돌아가신 지 10년")).toBe(false);
        expect(hasCrisisWord("죽을 만큼 보고 싶다")).toBe(false);
        const r = moderate("너무 힘들어서 자해를 했어");
        expect(r.ok).toBe(true);
        expect(r.crisis).toBe(true);
    });
});
