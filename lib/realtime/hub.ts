// 언덕 실시간 허브. Next 에 의존하지 않음 (나중에 따로 띄울 수 있게). 소켓은 send 함수만 받음
import { DAILY_WINDOW_MS, FIRE_KEEP_OUT, FIRE_POS, GESTURES, HILL_CAP, HILL_HALF_D, HILL_HALF_W, MIN_SEAT_DIST, TICK_MS, type ClientMsg, type DailyEvent, type Gesture, type MemberPublic, type Pose, type ServerMsg, type StarEvent } from "./protocol";
import { checkNickname } from "../nickname";

export type Socket = { send: (data: string) => void; close?: () => void };

type Member = {
    id: number;
    voterKey: string;
    country: string | null;
    x: number;
    z: number;
    pose: Pose;
    sockets: Set<Socket>;
    hill: Hill;
    dirty: boolean;
    lastGesture: number;
    lastMove: number;
    name: string | null;
    lastName: number;
};

type Hill = {
    name: string;
    members: Map<number, Member>;
    joined: MemberPublic[];
    left: number[];
};

const MOVE_MIN_INTERVAL = 150; // 이동 요청 최소 간격(ms)
const GESTURE_MIN_INTERVAL = 1500;
const NAME_MIN_INTERVAL = 1000; // 별명 바꾸기 최소 간격(ms)

export class Hub {
    private hills: Hill[] = [];
    private byVoter = new Map<string, Member>();
    private nextId = 1;
    private timer: ReturnType<typeof setInterval> | null = null;
    private countTimer: ReturnType<typeof setInterval> | null = null;
    private daily: DailyEvent | null = null;

    constructor(private cap = HILL_CAP) {}

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), TICK_MS);
        this.countTimer = setInterval(() => this.broadcastCount(), 5000);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.countTimer) clearInterval(this.countTimer);
        this.timer = this.countTimer = null;
    }

    // 접속: 같은 voter 는 탭이 여러 개여도 한 명. 언덕은 빈자리 있는 첫 언덕
    join(socket: Socket, voterKey: string, country: string | null): Member {
        let m = this.byVoter.get(voterKey);
        if (!m) {
            const hill = this.pickHill();
            const seat = this.pickSeat(hill);
            m = { id: this.nextId++, voterKey, country, x: seat.x, z: seat.z, pose: "sit", sockets: new Set(), hill, dirty: false, lastGesture: 0, lastMove: 0, name: null, lastName: 0 };
            hill.members.set(m.id, m);
            hill.joined.push(pub(m));
            this.byVoter.set(voterKey, m);
        }
        m.sockets.add(socket);
        const members = [...m.hill.members.values()].filter((o) => o.id !== m!.id).map(pub);
        const now = Date.now();
        const daily = this.daily && this.daily.until > now ? this.daily : null;
        this.send(socket, { t: "hello", id: m.id, hill: m.hill.name, you: pub(m), members, total: this.total(), countries: this.countries(), daily });
        return m;
    }

    leave(socket: Socket, member: Member) {
        member.sockets.delete(socket);
        if (member.sockets.size > 0) return;
        member.hill.members.delete(member.id);
        member.hill.left.push(member.id);
        this.byVoter.delete(member.voterKey);
    }

    handle(member: Member, raw: string) {
        let msg: ClientMsg;
        try {
            msg = JSON.parse(raw) as ClientMsg;
        } catch {
            return;
        }
        if (!msg || typeof msg !== "object") return;
        const now = Date.now();
        switch (msg.t) {
            case "move": {
                if (typeof msg.x !== "number" || typeof msg.z !== "number" || !Number.isFinite(msg.x) || !Number.isFinite(msg.z)) return;
                if (now - member.lastMove < MOVE_MIN_INTERVAL) return;
                member.lastMove = now;
                member.x = clamp(msg.x, -HILL_HALF_W, HILL_HALF_W);
                member.z = clamp(msg.z, -HILL_HALF_D, HILL_HALF_D);
                member.pose = "stand";
                member.dirty = true;
                break;
            }
            case "pose": {
                if (msg.p !== "sit" && msg.p !== "stand") return;
                if (member.pose === msg.p) return;
                member.pose = msg.p;
                member.dirty = true;
                break;
            }
            case "gesture": {
                if (!GESTURES.includes(msg.g)) return;
                if (now - member.lastGesture < GESTURE_MIN_INTERVAL) return;
                member.lastGesture = now;
                this.broadcastHill(member.hill, { t: "gesture", id: member.id, g: msg.g as Gesture });
                break;
            }
            case "name": {
                // 별명: 글과 같은 검사. 안 맞으면 이름표 없음. 너무 자주 바꾸면 무시
                if (now - member.lastName < NAME_MIN_INTERVAL) return;
                const c = checkNickname(typeof msg.n === "string" ? msg.n : null);
                const name = c.ok ? c.value : null;
                if (name === member.name) return;
                member.lastName = now;
                member.name = name;
                // 아직 묶음으로 안 나간 입장 소식에도 별명을 넣음 (별명이 입장보다 먼저 도착해 버려지는 것 방지)
                for (const j of member.hill.joined) if (j.id === member.id) j.n = name;
                this.broadcastHill(member.hill, { t: "name", id: member.id, n: name });
                break;
            }
            case "ping":
                for (const s of member.sockets) this.send(s, { t: "pong" });
                break;
        }
    }

    // API 라우트에서 온 이야기 이벤트(새 별·공감). 모든 언덕에 방송. 보낸 사람이 언덕에 있으면 그 자리에서 빛이 올라가게 id 붙임
    emitStar(e: Omit<StarEvent, "from"> & { voterKey?: string | null }) {
        const { voterKey, ...rest } = e;
        const from = voterKey ? this.byVoter.get(voterKey) : undefined;
        for (const hill of this.hills) {
            const ev: StarEvent = { ...rest, ...(from && from.hill === hill ? { from: from.id } : {}) };
            this.broadcastHill(hill, { t: "star", e: ev });
        }
    }

    // 의식(오늘의 이야기·마감 발표) 시작. 10분 안에 들어오는 사람도 hello 로 받음
    emitDaily(storyId: number, final = false, at = Date.now()) {
        this.daily = { storyId, at, until: at + DAILY_WINDOW_MS, final };
        this.broadcastAll({ t: "daily", e: this.daily });
    }

    total(): number {
        return this.byVoter.size;
    }

    countries(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const m of this.byVoter.values()) {
            const k = m.country || "??";
            out[k] = (out[k] || 0) + 1;
        }
        return out;
    }

    hillNames(): { name: string; count: number }[] {
        return this.hills.map((h) => ({ name: h.name, count: h.members.size }));
    }

    // ---- 내부 ----
    private pickHill(): Hill {
        for (const h of this.hills) if (h.members.size < this.cap) return h;
        const h: Hill = { name: `hill-${this.hills.length + 1}`, members: new Map(), joined: [], left: [] };
        this.hills.push(h);
        return h;
    }

    private pickSeat(hill: Hill): { x: number; z: number } {
        // 가운데 가까운 곳부터, 다른 사람과 겹치지 않는 자리. 20번 안에 못 찾으면 그냥 무작위
        for (let i = 0; i < 20; i++) {
            const spread = 0.35 + i * 0.035;
            const x = round1((Math.random() * 2 - 1) * HILL_HALF_W * spread);
            const z = round1((Math.random() * 2 - 1) * HILL_HALF_D * spread);
            let ok = Math.hypot(x - FIRE_POS.x, z - FIRE_POS.z) >= FIRE_KEEP_OUT;
            for (const m of hill.members.values()) {
                if (!ok) break;
                if (Math.hypot(m.x - x, m.z - z) < MIN_SEAT_DIST) {
                    ok = false;
                    break;
                }
            }
            if (ok) return { x, z };
        }
        return { x: round1((Math.random() * 2 - 1) * HILL_HALF_W), z: round1((Math.random() * 2 - 1) * HILL_HALF_D) };
    }

    private tick() {
        for (const hill of this.hills) {
            const moved: [number, number, number, Pose][] = [];
            for (const m of hill.members.values()) {
                if (!m.dirty) continue;
                m.dirty = false;
                moved.push([m.id, round1(m.x), round1(m.z), m.pose]);
            }
            if (moved.length === 0 && hill.joined.length === 0 && hill.left.length === 0) continue;
            const msg: ServerMsg = { t: "tick" };
            if (moved.length) msg.m = moved;
            if (hill.joined.length) msg.j = hill.joined;
            if (hill.left.length) msg.l = hill.left;
            hill.joined = [];
            hill.left = [];
            this.broadcastHill(hill, msg);
        }
        // 빈 언덕은 맨 뒤 것만 정리 (hill-1 은 항상 둠)
        while (this.hills.length > 1 && this.hills[this.hills.length - 1].members.size === 0) this.hills.pop();
    }

    private broadcastCount() {
        if (this.byVoter.size === 0) return;
        this.broadcastAll({ t: "count", total: this.total(), countries: this.countries() });
    }

    private broadcastHill(hill: Hill, msg: ServerMsg) {
        const data = JSON.stringify(msg);
        for (const m of hill.members.values()) for (const s of m.sockets) this.safeSend(s, data);
    }

    private broadcastAll(msg: ServerMsg) {
        const data = JSON.stringify(msg);
        for (const m of this.byVoter.values()) for (const s of m.sockets) this.safeSend(s, data);
    }

    private send(s: Socket, msg: ServerMsg) {
        this.safeSend(s, JSON.stringify(msg));
    }

    private safeSend(s: Socket, data: string) {
        try {
            s.send(data);
        } catch {
            /* 끊긴 소켓은 close 이벤트에서 정리됨 */
        }
    }
}

export type { Member };

function pub(m: Member): MemberPublic {
    return { id: m.id, c: m.country, x: round1(m.x), z: round1(m.z), p: m.pose, n: m.name };
}
function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v));
}
function round1(v: number) {
    return Math.round(v * 10) / 10;
}
