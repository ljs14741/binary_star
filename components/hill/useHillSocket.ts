"use client";
// 언덕 웹소켓 클라이언트. 위치 같은 잦은 갱신은 React 상태를 거치지 않고 bridge 객체로 3D 장면에 바로 전달
import { useEffect, useState } from "react";
import type { ClientMsg, DailyEvent, Gesture, MemberPublic, Pose, ServerMsg, StarEvent } from "@/lib/realtime/protocol";

export type HillHandlers = {
    onHello?: (you: MemberPublic, members: MemberPublic[]) => void;
    onTick?: (moved: [number, number, number, Pose][], joined: MemberPublic[], left: number[]) => void;
    onGesture?: (id: number, g: Gesture) => void;
    onStar?: (e: StarEvent) => void;
    onDaily?: (e: DailyEvent) => void;
};

// 소켓과 3D 장면 사이 다리. 렌더와 무관한 가변 상태라 클래스 메서드로만 바꿈
export class HillBridge {
    meId: number | null = null;
    members = new Map<number, MemberPublic>();
    private handlers: HillHandlers = {};
    private sender: ((m: ClientMsg) => void) | null = null;
    use(h: HillHandlers) {
        this.handlers = h;
    }
    clear() {
        this.handlers = {};
    }
    attach(sender: ((m: ClientMsg) => void) | null) {
        this.sender = sender;
    }
    send(m: ClientMsg) {
        this.sender?.(m);
    }
    hello(id: number, you: MemberPublic, members: MemberPublic[]) {
        this.meId = id;
        this.members = new Map(members.map((m) => [m.id, m]));
        this.members.set(you.id, you);
        this.handlers.onHello?.(you, members);
    }
    tick(moved: [number, number, number, Pose][], joined: MemberPublic[], left: number[]) {
        for (const m of joined) this.members.set(m.id, m);
        for (const id of left) this.members.delete(id);
        for (const [id, x, z, p] of moved) {
            const m = this.members.get(id);
            if (m) {
                m.x = x;
                m.z = z;
                m.p = p;
            }
        }
        this.handlers.onTick?.(moved, joined, left);
    }
    gesture(id: number, g: Gesture) {
        this.handlers.onGesture?.(id, g);
    }
    star(e: StarEvent) {
        this.handlers.onStar?.(e);
    }
    daily(e: DailyEvent) {
        this.handlers.onDaily?.(e);
    }
}

export type HillStatus = "connecting" | "open" | "offline" | "full";

export function useHillSocket(enabled: boolean) {
    const [bridge] = useState(() => new HillBridge());
    const [status, setStatus] = useState<HillStatus>("connecting");
    const [total, setTotal] = useState(0);
    const [countries, setCountries] = useState<Record<string, number>>({});
    const [daily, setDaily] = useState<DailyEvent | null>(null);
    const [lastStar, setLastStar] = useState<StarEvent | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let ws: WebSocket | null = null;
        let closed = false;
        let retry = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const b = bridge;

        const connect = () => {
            if (closed) return;
            const proto = location.protocol === "https:" ? "wss" : "ws";
            try {
                ws = new WebSocket(`${proto}://${location.host}/ws`);
            } catch {
                schedule();
                return;
            }
            ws.onopen = () => {
                retry = 0;
            };
            ws.onmessage = (ev) => {
                let msg: ServerMsg;
                try {
                    msg = JSON.parse(String(ev.data)) as ServerMsg;
                } catch {
                    return;
                }
                switch (msg.t) {
                    case "hello":
                        b.hello(msg.id, msg.you, msg.members);
                        setStatus("open");
                        setTotal(msg.total);
                        setCountries(msg.countries);
                        if (msg.daily) setDaily(msg.daily);
                        break;
                    case "tick":
                        b.tick(msg.m ?? [], msg.j ?? [], msg.l ?? []);
                        break;
                    case "gesture":
                        b.gesture(msg.id, msg.g);
                        break;
                    case "star":
                        b.star(msg.e);
                        setLastStar(msg.e);
                        break;
                    case "count":
                        setTotal(msg.total);
                        setCountries(msg.countries);
                        break;
                    case "daily":
                        setDaily(msg.e);
                        b.daily(msg.e);
                        break;
                    case "full":
                        setStatus("full");
                        break;
                }
            };
            ws.onclose = () => {
                if (closed) return;
                setStatus((s) => (s === "full" ? s : "offline"));
                schedule();
            };
            ws.onerror = () => {
                try {
                    ws?.close();
                } catch {}
            };
        };
        const schedule = () => {
            if (closed) return;
            const wait = Math.min(1000 * Math.pow(1.7, retry++), 15000);
            timer = setTimeout(connect, wait);
        };
        b.attach((m) => {
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
        });
        // 화면 숨기면 끊고, 다시 보이면 바로 연결 (배터리)
        const onVis = () => {
            if (document.visibilityState === "hidden") {
                try {
                    ws?.close();
                } catch {}
            } else if (!ws || ws.readyState !== WebSocket.OPEN) {
                if (timer) clearTimeout(timer);
                retry = 0;
                connect();
            }
        };
        document.addEventListener("visibilitychange", onVis);
        timer = setTimeout(connect, 0);
        return () => {
            closed = true;
            b.attach(null);
            document.removeEventListener("visibilitychange", onVis);
            if (timer) clearTimeout(timer);
            try {
                ws?.close();
            } catch {}
        };
    }, [enabled, bridge]);

    return { bridge, status, total, countries, daily, lastStar };
}
