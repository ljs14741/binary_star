import { cookies } from "next/headers";
import { json, err } from "@/lib/api";

// 개발용: localhost 는 IP 위치가 없어서 쿠키로 위치를 흉내 냄
// /api/dev/geo?set=JP,Tokyo,35.7,139.7   /api/dev/geo?clear=1
export async function GET(req: Request) {
    if (process.env.NODE_ENV === "production") return err("not_found", 404);
    const u = new URL(req.url);
    const c = await cookies();
    if (u.searchParams.get("clear")) {
        c.delete("star_dev_geo");
        return json({ ok: true, geo: null });
    }
    const set = u.searchParams.get("set");
    if (!set) return json({ ok: true, geo: c.get("star_dev_geo")?.value ?? null, hint: "?set=JP,Tokyo,35.7,139.7 또는 ?clear=1" });
    c.set("star_dev_geo", set, { path: "/", maxAge: 60 * 60 * 24 });
    return json({ ok: true, geo: set });
}
