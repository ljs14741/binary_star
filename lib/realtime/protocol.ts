// 언덕 실시간 메시지 형식 (클라이언트·서버 공용). JSON, 작게
export type Pose = "sit" | "stand";
export type Gesture = "wave" | "lookup" | "hug";
export const GESTURES: Gesture[] = ["wave", "lookup", "hug"];

// 언덕 평면 좌표 범위 (x: 좌우, z: 앞뒤. 카메라는 +z 쪽에서 -z(하늘)를 봄)
export const HILL_HALF_W = 9;
export const HILL_HALF_D = 4.5;
export const HILL_CAP = 150; // 언덕 정원
export const MIN_SEAT_DIST = 0.9; // 자리 사이 최소 거리
export const FIRE_POS = { x: 0, z: -1.2 }; // 모닥불 자리 (언덕 가운데 조금 앞). 자리 배정 때 피함
export const FIRE_KEEP_OUT = 1.3;
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
    | { t: "ping" };

export type StarEvent = { kind: "born" | "glow" | "dim"; storyId: number; roomSlug: string; count: number; lang: string; from?: number };
export type DailyEvent = { storyId: number; at: number; until: number; final?: boolean };

// 서버 → 클라이언트
export type ServerMsg =
    | { t: "hello"; id: number; hill: string; you: MemberPublic; members: MemberPublic[]; total: number; countries: Record<string, number>; daily: DailyEvent | null }
    | { t: "tick"; m?: [number, number, number, Pose][]; j?: MemberPublic[]; l?: number[] }
    | { t: "gesture"; id: number; g: Gesture }
    | { t: "name"; id: number; n: string | null }
    | { t: "star"; e: StarEvent }
    | { t: "count"; total: number; countries: Record<string, number> }
    | { t: "daily"; e: DailyEvent }
    | { t: "pong" }
    | { t: "full" };
