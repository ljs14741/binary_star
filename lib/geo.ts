// IP → 나라·도시. DB-IP Lite(mmdb) 파일을 읽고, 없거나 실패하면 Accept-Language 로 나라만 추정
import fs from "fs";
import path from "path";
import type { CityResponse, Reader } from "maxmind";

export type Geo = { country: string | null; city: string | null; lat: number | null; lng: number | null };
export const EMPTY_GEO: Geo = { country: null, city: null, lat: null, lng: null };

let reader: Reader<CityResponse> | null | undefined;

async function getReader(): Promise<Reader<CityResponse> | null> {
    if (reader !== undefined) return reader;
    const file = path.join(process.cwd(), "data/geo/dbip-city-lite.mmdb");
    if (!fs.existsSync(file)) {
        console.warn("[geo] data/geo/dbip-city-lite.mmdb 없음 → npm run geo:download. Accept-Language 로만 추정함");
        reader = null;
        return reader;
    }
    try {
        const maxmind = await import("maxmind");
        reader = await maxmind.open<CityResponse>(file);
    } catch (e) {
        console.warn("[geo] mmdb 열기 실패", e);
        reader = null;
    }
    return reader;
}

function isPrivateIp(ip: string): boolean {
    return (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
        ip.startsWith("fc") ||
        ip.startsWith("fd") ||
        ip.startsWith("::ffff:127.")
    );
}

// 좌표는 소수 1자리(약 10km)로 뭉개서 저장
const round1 = (n: number) => Math.round(n * 10) / 10;

// 개발용 강제 위치: "KR,Seoul,37.6,127.0"
export function parseDevGeo(v: string | null | undefined): Geo | null {
    if (!v) return null;
    const [country, city, lat, lng] = v.split(",").map((s) => s.trim());
    if (!country) return null;
    return {
        country: country.toUpperCase().slice(0, 2),
        city: city || null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
    };
}

export function countryFromAcceptLanguage(al: string | null | undefined): string | null {
    if (!al) return null;
    const m = al.match(/[a-z]{2,3}-([A-Za-z]{2})/);
    if (m) return m[1].toUpperCase();
    const first = al.split(",")[0].trim().toLowerCase();
    if (first.startsWith("ko")) return "KR";
    if (first.startsWith("ja")) return "JP";
    if (first.startsWith("zh")) return "TW";
    if (first.startsWith("en")) return "US";
    return null;
}

export async function lookupGeo(ip: string, acceptLanguage: string | null, devOverride?: string | null): Promise<Geo> {
    if (process.env.NODE_ENV !== "production") {
        const dev = parseDevGeo(devOverride) || parseDevGeo(process.env.STAR_DEV_GEO);
        if (dev) return dev;
    }
    if (ip && !isPrivateIp(ip)) {
        const r = await getReader();
        if (r) {
            try {
                const res = r.get(ip);
                if (res) {
                    const country = res.country?.iso_code || null;
                    const city = res.city?.names?.en || null;
                    const lat = res.location?.latitude;
                    const lng = res.location?.longitude;
                    if (country) {
                        return {
                            country,
                            city,
                            lat: typeof lat === "number" ? round1(lat) : null,
                            lng: typeof lng === "number" ? round1(lng) : null,
                        };
                    }
                }
            } catch {
                /* 아래 폴백 */
            }
        }
    }
    return { country: countryFromAcceptLanguage(acceptLanguage), city: null, lat: null, lng: null };
}
