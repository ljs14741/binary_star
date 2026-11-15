// 언덕 실시간 메시지 형식 (클라이언트·서버 공용). JSON, 작게
export type Pose = "sit" | "stand";
// 몸짓·감정 표현. wave 손 흔들기, heart 마음, pat 토닥토닥, tear 뭉클, joy 웃음, lookup 별 보기, hug (예전 것, 남겨 둠)
export type Gesture = "wave" | "heart" | "pat" | "tear" | "joy" | "lookup" | "hug";
export const GESTURES: Gesture[] = ["wave", "heart", "pat", "tear", "joy", "lookup", "hug"];
export const EMOTES: Gesture[] = ["wave", "heart", "pat", "tear", "joy", "lookup"]; // 표현 버튼에 펼쳐지는 순서

// 언덕 평면 좌표 범위 (x: 좌우, z: 앞뒤. 카메라는 +z 쪽에서 -z(하늘)를 봄)
export const HILL_HALF_W = 9;
export const HILL_HALF_D = 4.5;
export const HILL_CAP = 60; // 언덕 정원. 모닥불 둘레에 겹치지 않고 앉을 수 있는 수 (넘치면 같은 하늘의 두 번째 언덕)
export const MIN_SEAT_DIST = 0.9; // 자리 사이 최소 거리
export const FIRE_POS = { x: 0, z: -1.2 }; // 모닥불 자리 (언덕 가운데 조금 앞). 자리 배정 때 피함
export const FIRE_KEEP_OUT = 1.7; // 불 둘레 빈자리 (모닥불 키우며 1.3 → 1.7)
export const TICK_MS = 100; // 10Hz 묶음 전송
export const DAILY_WINDOW_MS = 10 * 60 * 1000; // 의식 뒤 10분 안에 들어오면 같은 연출

// n: 별명 (없으면 null → 화면엔 이름표 없음)
export type MemberPublic = { id: number; c: string | null; x: number; z: number; p: Pose; n?: string | null };

// 클라이언트 → 서버
export type ClientMsg =
    | { t: "move"; x: number; z: number }
    | { t: "pose"; p: Pose }
    | { t: "gesture"; g: Gesture }
    | { t: "name"; n: string | null }
    | { t: "gift"; to: number } // 다른 요정에게 마음 보내기
    | { t: "lantern" } // 소원 부두에서 풍등 띄움 (소원 글은 HTTP 로 따로 저장)
    | { t: "ping" };

export type StarEvent = { kind: "born" | "glow" | "dim"; storyId: number; roomSlug: string; count: number; lang: string; from?: number };
export type DailyEvent = { storyId: number; at: number; until: number; final?: boolean };

// 서버 → 클라이언트
export type ServerMsg =
    | { t: "hello"; id: number; hill: string; you: MemberPublic; members: MemberPublic[]; total: number; countries: Record<string, number>; daily: DailyEvent | null }
    | { t: "tick"; m?: [number, number, number, Pose][]; j?: MemberPublic[]; l?: number[] }
    | { t: "gesture"; id: number; g: Gesture }
    | { t: "name"; id: number; n: string | null }
    | { t: "gift"; from: number; to: number }
    | { t: "lantern"; id: number }
    | { t: "star"; e: StarEvent }
    | { t: "count"; total: number; countries: Record<string, number> }
    | { t: "daily"; e: DailyEvent }
    | { t: "pong" }
    | { t: "full" };
