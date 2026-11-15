import { describe, it, expect } from "vitest";
import { Hub, type Socket } from "@/lib/realtime/hub";
import type { ServerMsg } from "@/lib/realtime/protocol";

function fakeSocket() {
    const log: ServerMsg[] = [];
    const s: Socket & { log: ServerMsg[] } = { log, send: (d: string) => log.push(JSON.parse(d)) };
    return s;
}
const last = (s: { log: ServerMsg[] }) => s.log[s.log.length - 1];

describe("언덕 허브", () => {
    it("접속하면 hello 를 받고, 같은 언덕 사람 목록이 옴", () => {
        const hub = new Hub(150);
        const a = fakeSocket();
        const ma = hub.join(a, "voter-a", "KR");
        expect(last(a)).toMatchObject({ t: "hello", id: ma.id, hill: "hill-1", total: 1 });
        const b = fakeSocket();
        hub.join(b, "voter-b", "JP");
        const hb = last(b) as Extract<ServerMsg, { t: "hello" }>;
        expect(hb.members.map((m) => m.id)).toEqual([ma.id]);
        expect(hb.total).toBe(2);
        expect(hb.countries).toEqual({ KR: 1, JP: 1 });
    });

    it("같은 voter 는 탭이 여러 개여도 한 명, 마지막 탭이 닫혀야 떠남", () => {
        const hub = new Hub(150);
        const a1 = fakeSocket(), a2 = fakeSocket();
        const m1 = hub.join(a1, "voter-a", "KR");
        const m2 = hub.join(a2, "voter-a", "KR");
        expect(m1.id).toBe(m2.id);
        expect(hub.total()).toBe(1);
        hub.leave(a1, m1);
        expect(hub.total()).toBe(1);
        hub.leave(a2, m2);
        expect(hub.total()).toBe(0);
    });

    it("별명은 검사해서 같은 언덕에 알리고, 새로 온 사람은 hello 에서 받음", () => {
        const hub = new Hub(150);
        const a = fakeSocket(), b = fakeSocket();
        const ma = hub.join(a, "voter-na", "KR");
        hub.join(b, "voter-nb", "KR");
        hub.handle(ma, JSON.stringify({ t: "name", n: "포근한 고양이" }));
        expect(last(b)).toEqual({ t: "name", id: ma.id, n: "포근한 고양이" });
        const c = fakeSocket();
        hub.join(c, "voter-nc", "JP");
        const hc = last(c) as Extract<ServerMsg, { t: "hello" }>;
        expect(hc.members.find((m) => m.id === ma.id)?.n).toBe("포근한 고양이");
        // 금칙어 별명은 이름표 없음 (1초 간격 제한 지나서)
        const mb = hub.join(fakeSocket(), "voter-nd", "KR");
        hub.handle(mb, JSON.stringify({ t: "name", n: "섹스왕" }));
        expect(c.log.some((m) => m.t === "name" && m.id === mb.id)).toBe(false);
    });

    it("정원이 차면 다음 언덕으로", () => {
        const hub = new Hub(2);
        hub.join(fakeSocket(), "v1", null);
        hub.join(fakeSocket(), "v2", null);
        const c = fakeSocket();
        hub.join(c, "v3", null);
        expect(last(c)).toMatchObject({ t: "hello", hill: "hill-2" });
        expect(hub.hillNames()).toEqual([{ name: "hill-1", count: 2 }, { name: "hill-2", count: 1 }]);
    });

    it("이동·앉기는 다음 틱에 묶여서 같은 언덕에만, 몸짓은 바로", () => {
        const hub = new Hub(150);
        const a = fakeSocket(), b = fakeSocket();
        const ma = hub.join(a, "va", "KR");
        hub.join(b, "vb", "JP");
        hub.handle(ma, JSON.stringify({ t: "move", x: 2.5, z: 1 }));
        hub.handle(ma, JSON.stringify({ t: "gesture", g: "wave" }));
        expect(last(b)).toMatchObject({ t: "gesture", id: ma.id, g: "wave" });
        // 틱 전엔 이동 없음
        expect(b.log.some((m) => m.t === "tick")).toBe(false);
        (hub as unknown as { tick: () => void }).tick();
        const tick = b.log.find((m) => m.t === "tick") as Extract<ServerMsg, { t: "tick" }>;
        expect(tick.m).toEqual([[ma.id, 2.5, 1, "stand"]]);
        expect(tick.j?.map((m) => m.id)).toContain(ma.id);
    });

    it("범위 밖 좌표는 잘리고 이상한 메시지는 무시", () => {
        const hub = new Hub(150);
        const a = fakeSocket();
        const ma = hub.join(a, "va", "KR");
        hub.handle(ma, JSON.stringify({ t: "move", x: 999, z: -999 }));
        expect(ma.x).toBe(9);
        expect(ma.z).toBe(-4.5);
        hub.handle(ma, "not json");
        hub.handle(ma, JSON.stringify({ t: "gesture", g: "dance" }));
        expect(a.log.filter((m) => m.t === "gesture")).toHaveLength(0);
    });

    it("이야기 이벤트는 모든 언덕에, 보낸 사람이 있는 언덕에만 from 이 붙음", () => {
        const hub = new Hub(1);
        const a = fakeSocket(), b = fakeSocket();
        const ma = hub.join(a, "va", "KR");
        hub.join(b, "vb", "JP"); // hill-2
        hub.emitStar({ kind: "glow", storyId: 7, roomSlug: "first-love", count: 3, lang: "ko", voterKey: "va" });
        expect(last(a)).toMatchObject({ t: "star", e: { kind: "glow", storyId: 7, from: ma.id } });
        const eb = last(b) as Extract<ServerMsg, { t: "star" }>;
        expect(eb.e.from).toBeUndefined();
    });

    it("의식은 전체 방송, 10분 안에 들어온 사람은 hello 로 받음", () => {
        const hub = new Hub(150);
        const a = fakeSocket();
        hub.join(a, "va", "KR");
        hub.emitDaily(42, false, 1000);
        expect(last(a)).toMatchObject({ t: "daily", e: { storyId: 42 } });
        const b = fakeSocket();
        hub.join(b, "vb", "JP");
        // emitDaily 의 at 이 과거(1000)라 until 도 지났음 → 안 줌
        expect((last(b) as Extract<ServerMsg, { t: "hello" }>).daily).toBeNull();
        hub.emitDaily(43, true);
        const c = fakeSocket();
        hub.join(c, "vc", "TW");
        expect((last(c) as Extract<ServerMsg, { t: "hello" }>).daily).toMatchObject({ storyId: 43, final: true });
    });
});
