// 사이트 공통 설정. 서비스 이름은 가칭이라 여기 한 곳에서만 바꾸면 됨
import type { Lang } from "@/lib/i18n/config";

// 언어별 이름 (가칭). env 로 바꿀 수 있음
const NAMES: Record<Lang, string> = {
    ko: process.env.NEXT_PUBLIC_SITE_NAME_KO || "별말씀",
    en: process.env.NEXT_PUBLIC_SITE_NAME_EN || "Star Words",
    ja: process.env.NEXT_PUBLIC_SITE_NAME_JA || "星のことば",
    "zh-TW": process.env.NEXT_PUBLIC_SITE_NAME_ZH || "星語",
};

export function siteName(lang: Lang): string {
    return NAMES[lang] ?? NAMES.en;
}

// 애드센스 자동광고 (binaryworld 계정). localhost·개발 모드에선 안 넣음
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-6890085609044109";

// binaryworld 의 다른 서비스 (푸터 상호 링크)
export const SISTER_SITES = [
    { name: "binaryworld", url: "https://binaryworld.kr" },
    { name: "game", url: "https://game.binaryworld.kr" },
    { name: "wedding", url: "https://wedding.binaryworld.kr" },
    { name: "quiz", url: "https://quiz.binaryworld.kr" },
    { name: "map", url: "https://map.binaryworld.kr" },
] as const;
// 별말씀에서 넘어간 걸 애널리틱스에서 알 수 있게 붙이는 표시
export const sisterUrl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}utm_source=star&utm_medium=link`;

// 올린 뒤 수정·삭제 가능한 시간
export const EDIT_WINDOW_MS = 10 * 60 * 1000;
export const NICKNAME_MAX_LEN = 10;
// 거짓 공감 방지: 같은 IP/24 가 같은 이야기에 하루 몇 번까지
export const EMPATHY_PER_IP_PER_STORY_DAY = 3;
export const EMPATHY_PER_IP_PER_MINUTE = 60;

export function getBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, "");
}

export function isLocalhost(): boolean {
    return /localhost|127\.0\.0\.1/.test(getBaseUrl());
}

// 이야기 본문 상한
export const STORY_MAX_LEN = 2000;
export const PROPOSAL_MAX_LEN = 60;
// 제안이 정식 방이 되는 공감 수
export const PROPOSAL_THRESHOLD = Number(process.env.PROPOSAL_THRESHOLD || 100);
// 신고 자동 숨김 기준
export const REPORT_HIDE_COUNT = 3;
// "오르는 중" 표시 기준 (24시간 공감 증가)
export const RISING_MIN = 3;
// 나이대·나라별 1위 표본 최소
export const TOP_MIN_SAMPLE = 5;
// 하루 작성 제한
export const DAILY_STORY_LIMIT = 10;
export const DAILY_PROPOSAL_LIMIT = 3;
export const EMPATHY_PER_MINUTE = 30;

export const AGE_GROUPS = ["10s", "20s", "30s", "40s", "50s", "60s"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
