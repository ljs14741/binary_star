// API 라우트(Next) → 실시간 허브(server.ts) 로 이벤트 전달. 같은 프로세스지만 dev 에선 프로세스가 갈릴 수 있어 HTTP 로 보냄
// 나중에 허브를 따로 띄우면 RT_EMIT_URL 만 바꾸면 됨
const SECRET = process.env.STAR_SECRET || "star-dev-secret";

function emitUrl(path: string): string {
    const base = process.env.RT_EMIT_URL || `http://127.0.0.1:${process.env.PORT || 3100}`;
    return `${base}${path}`;
}

async function post(path: string, body: unknown) {
    try {
        await fetch(emitUrl(path), {
            method: "POST",
            headers: { "content-type": "application/json", "x-rt-secret": SECRET },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(1500),
        });
    } catch {
        /* 허브가 없어도(테스트·스크립트) 조용히 무시 */
    }
}

export type StarEmit = { kind: "born" | "glow" | "dim"; storyId: number; roomSlug: string; count: number; lang: string; voterKey?: string | null };

// 새 별(공개 이야기 생성)·별 밝아짐(공감)·어두워짐(공감 취소). 기다리지 않음
export function emitStar(e: StarEmit) {
    void post("/_rt/emit", e);
}

// 의식 시작 (오늘의 이야기 / 이번 달 마감 발표)
export function emitDaily(storyId: number, final = false) {
    void post("/_rt/daily", { storyId, final });
}
