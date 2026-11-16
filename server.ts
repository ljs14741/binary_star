// 커스텀 서버: Next 와 웹소켓(/ws)을 같은 포트(3100)에서. 실행: npm run dev / npm run start
// 허브는 lib/realtime/hub.ts (Next 비의존). 나중에 따로 띄우려면 이 파일의 /ws·/_rt 부분만 떼면 됨
import "./lib/load-env"; // 반드시 첫 import (STAR_SECRET 등이 아래 모듈 로드 전에 있어야 voter_key 가 Next 쪽과 같아짐)
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { Hub, type Member } from "./lib/realtime/hub";
import { lookupGeo } from "./lib/geo";
import { cookieValue, ipFromHeaders, makeVoterKey, VISITOR_COOKIE } from "./lib/voter-core";
import { newVisitorId } from "./lib/crypto";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3100", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const SECRET = process.env.STAR_SECRET || "star-dev-secret";
const DAILY_HOUR_KST = parseInt(process.env.DAILY_HOUR_KST || "22", 10);

// Next 는 첫 요청 때 req.socket.server 에 자기 'upgrade' 리스너를 몰래 붙여 /ws 까지 가로채 끊어 버림
// → 듣지 않는 빈 서버를 httpServer 로 넘겨 거기에 붙게 하고, 업그레이드는 아래에서 우리가 나눠 줌
const decoy = createServer();
const app = next({ dev, hostname, port, httpServer: decoy });
const handle = app.getRequestHandler();
const hub = new Hub();

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (c) => {
            data += c;
            if (data.length > 10_000) req.destroy();
        });
        req.on("end", () => resolve(data));
        req.on("error", () => resolve(""));
    });
}

function isLoopback(req: IncomingMessage): boolean {
    const a = req.socket.remoteAddress || "";
    return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

// 내부 이벤트(API 라우트 → 허브). 같은 기계에서 비밀 헤더 붙여서만
async function handleInternal(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    if (!path.startsWith("/_rt/")) return false;
    if (req.method !== "POST" || !isLoopback(req) || req.headers["x-rt-secret"] !== SECRET) {
        res.statusCode = 403;
        res.end("forbidden");
        return true;
    }
    let body: Record<string, unknown> = {};
    try {
        body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    } catch {
        /* 빈 몸통 */
    }
    if (path === "/_rt/emit") {
        const kind = body.kind;
        if ((kind === "born" || kind === "glow" || kind === "dim") && typeof body.storyId === "number") {
            hub.emitStar({ kind, storyId: body.storyId, roomSlug: String(body.roomSlug || ""), count: Number(body.count) || 0, lang: String(body.lang || "ko"), voterKey: typeof body.voterKey === "string" ? body.voterKey : null });
        }
    } else if (path === "/_rt/daily") {
        if (typeof body.storyId === "number") hub.emitDaily(body.storyId, !!body.final);
    } else if (path === "/_rt/stats") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ total: hub.total(), countries: hub.countries(), hills: hub.hillNames() }));
        return true;
    }
    res.statusCode = 204;
    res.end();
    return true;
}

// ---- 의식 스케줄: 매일 22:00 KST "오늘의 이야기", 이번 달 주제 마감 ----
function nextDailyAt(now = Date.now()): number {
    // KST = UTC+9, 서머타임 없음
    const kst = new Date(now + 9 * 3600 * 1000);
    const target = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), DAILY_HOUR_KST, 0, 0) - 9 * 3600 * 1000;
    return target > now ? target : target + 24 * 3600 * 1000;
}

async function fireDaily(final = false) {
    try {
        const r = await fetch(`http://127.0.0.1:${port}/api/hill/daily${final ? "?final=1" : ""}`, { headers: { "x-rt-secret": SECRET }, signal: AbortSignal.timeout(10_000) });
        const j = (await r.json()) as { ok: boolean; story?: { id: number } | null };
        if (j.ok && j.story) hub.emitDaily(j.story.id, final);
    } catch (e) {
        console.warn("[hill] 오늘의 이야기 불러오기 실패", e);
    }
}

function scheduleDaily() {
    const at = nextDailyAt();
    setTimeout(async () => {
        await fireDaily(false);
        scheduleDaily();
    }, at - Date.now());
    console.log(`[hill] 오늘의 이야기 예정: ${new Date(at).toISOString()}`);
}

let lastFinalCheck: string | null = null;
async function checkFeaturedClose() {
    // 이번 달 주제 마감이 지난 2분 안이면 1위 발표 (한 번만)
    try {
        const r = await fetch(`http://127.0.0.1:${port}/api/hill/daily?final=check`, { headers: { "x-rt-secret": SECRET }, signal: AbortSignal.timeout(10_000) });
        const j = (await r.json()) as { ok: boolean; due?: string | null; story?: { id: number } | null };
        if (j.ok && j.due && j.story && j.due !== lastFinalCheck) {
            lastFinalCheck = j.due;
            hub.emitDaily(j.story.id, true);
        }
    } catch {
        /* 다음 분에 다시 */
    }
}

app.prepare().then(() => {
    // Next 16: 공개 getUpgradeHandler() 는 렌더 서버 것이라 HMR 소켓에 응답을 안 해 브라우저가 다음 웹소켓을 미룸(throttle)
    // → Next 가 내부에서 쓰는 라우터 서버 핸들러(upgradeHandler getter)를 씀. prepare() 뒤에만 됨
    const upgrade = (app as unknown as { upgradeHandler: (req: IncomingMessage, socket: import("stream").Duplex, head: Buffer) => Promise<void> }).upgradeHandler;
    const server = createServer(async (req, res) => {
        const path = (req.url || "/").split("?")[0];
        if (await handleInternal(req, res, path)) return;
        handle(req, res);
    });

    const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
    const WS_PER_VOTER = 3;
    const WS_PER_IP = 30;
    const wsPerVoter = new Map<string, number>();
    const wsPerIp = new Map<string, number>();

    server.on("upgrade", async (req, socket, head) => {
        const path = (req.url || "/").split("?")[0];
        if (path !== "/ws") {
            // Next 의 HMR 등
            upgrade(req, socket, head);
            return;
        }
        // 같은 사이트에서 연 소켓만
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (origin && host) {
            try {
                if (new URL(origin).host !== host) {
                    socket.destroy();
                    return;
                }
            } catch {
                socket.destroy();
                return;
            }
        }
        const cookie = req.headers.cookie;
        socket.on("error", () => {
            /* 핸드셰이크 중 끊김 */
        });
        const vid = cookieValue(cookie, VISITOR_COOKIE) || newVisitorId();
        // Next 는 x-forwarded-for 가 없으면 socket.remoteAddress 를 넣어 voter_key 를 만듦 → 웹소켓도 같은 값으로 (같은 사람으로 맞추기)
        const ip = ipFromHeaders((n) => {
            const v = req.headers[n];
            return Array.isArray(v) ? v[0] : v;
        }, req.socket.remoteAddress || "127.0.0.1");
        const voterKey = makeVoterKey(vid, ip);
        // 가짜 요정 막기: 브라우저 하나당 3개, IP 하나당 30개 (통신사 IP 는 여럿이 같이 써서 넉넉히)
        if ((wsPerVoter.get(voterKey) ?? 0) >= WS_PER_VOTER || (wsPerIp.get(ip) ?? 0) >= WS_PER_IP) {
            socket.destroy();
            return;
        }
        const geo = await lookupGeo(ip, req.headers["accept-language"] ?? null, dev ? cookieValue(cookie, "star_dev_geo") : null);
        if (socket.destroyed) return;
        wss.handleUpgrade(req, socket, head, (ws) => {
            countUp(wsPerVoter, voterKey);
            countUp(wsPerIp, ip);
            ws.once("close", () => {
                countDown(wsPerVoter, voterKey);
                countDown(wsPerIp, ip);
            });
            attach(ws, voterKey, geo.country);
        });
    });

    function countUp(m: Map<string, number>, k: string) {
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    function countDown(m: Map<string, number>, k: string) {
        const n = (m.get(k) ?? 1) - 1;
        if (n > 0) m.set(k, n);
        else m.delete(k);
    }

    function attach(ws: WebSocket, voterKey: string, country: string | null) {
        const sock = { send: (d: string) => ws.send(d), close: () => ws.close() };
        let member: Member | null = null;
        try {
            member = hub.join(sock, voterKey, country);
        } catch {
            ws.close();
            return;
        }
        let alive = true;
        ws.on("pong", () => (alive = true));
        ws.on("message", (data) => {
            if (!member) return;
            hub.handle(member, data.toString().slice(0, 500));
        });
        ws.on("close", () => {
            if (member) hub.leave(sock, member);
        });
        ws.on("error", () => {
            if (member) hub.leave(sock, member);
        });
        // 죽은 소켓 정리 (30초 무응답이면 끊음)
        const iv = setInterval(() => {
            if (!alive) {
                clearInterval(iv);
                ws.terminate();
                return;
            }
            alive = false;
            try {
                ws.ping();
            } catch {
                /* 닫힘 */
            }
        }, 30_000);
        ws.on("close", () => clearInterval(iv));
    }

    hub.start();
    scheduleDaily();
    setInterval(checkFeaturedClose, 60_000);

    server.listen(port, hostname, () => {
        console.log(`> ${dev ? "dev" : "prod"} http://localhost:${port} (ws: /ws)`);
    });
});
