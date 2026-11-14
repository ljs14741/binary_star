// 아주 짧은 메모리 캐시 (방 목록·1위 같은 읽기 많은 조회용). 인스턴스 1개라 충분
const store = new Map<string, { v: unknown; exp: number; p?: Promise<unknown> }>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cur = store.get(key);
    if (cur && cur.exp > now) return cur.v as T;
    if (cur?.p) return cur.p as Promise<T>; // 동시에 여러 요청이 와도 한 번만 계산
    const p = fn().then((v) => {
        store.set(key, { v, exp: Date.now() + ttlMs });
        return v;
    });
    store.set(key, { v: cur?.v, exp: 0, p });
    try {
        return await p;
    } catch (e) {
        store.delete(key);
        throw e;
    }
}

export function memoClear(prefix?: string) {
    if (!prefix) return store.clear();
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
