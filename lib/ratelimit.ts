// 인메모리 요청 제한. 인스턴스 1개라 충분함
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const cur = store.get(key);
    if (!cur || cur.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    cur.count += 1;
    if (store.size > 50_000) {
        for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
    }
    return cur.count <= max;
}

// 테스트용 초기화
export function resetRateLimit() {
    store.clear();
}
