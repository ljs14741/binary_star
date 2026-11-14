// Next 16 의 미들웨어(proxy). "/" 는 브라우저 언어로 보내고, 방문자 쿠키가 없으면 발급함
import { NextResponse, type NextRequest } from "next/server";
import { isLang, pickLang, LANGS } from "@/lib/i18n/config";

const VISITOR_COOKIE = "star_vid";
const LANG_COOKIE = "star_lang";

function randomId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const first = pathname.split("/")[1];

    let res: NextResponse;
    if (pathname === "/" || pathname === "") {
        const saved = req.cookies.get(LANG_COOKIE)?.value;
        const lang = isLang(saved) ? saved : pickLang(req.headers.get("accept-language"));
        res = NextResponse.redirect(new URL(`/${lang}${search}`, req.url));
    } else if (first === "me" || first === "s" || first === "room") {
        // 언어 없는 짧은 주소 → 언어 붙여서 이동 (/me/{token}, /s/{id})
        const saved = req.cookies.get(LANG_COOKIE)?.value;
        const lang = isLang(saved) ? saved : pickLang(req.headers.get("accept-language"));
        res = NextResponse.redirect(new URL(`/${lang}${pathname}${search}`, req.url));
    } else {
        const headers = new Headers(req.headers);
        if (isLang(first)) headers.set("x-star-lang", first);
        res = NextResponse.next({ request: { headers } });
        if (isLang(first) && req.cookies.get(LANG_COOKIE)?.value !== first) {
            res.cookies.set(LANG_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
        }
    }
    if (!req.cookies.get(VISITOR_COOKIE)?.value) {
        res.cookies.set(VISITOR_COOKIE, randomId(), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 400 });
    }
    return res;
}

export const config = {
    // 정적 파일·이미지·api 는 건너뜀 (api 는 각 라우트가 쿠키 직접 처리)
    matcher: ["/((?!api|_next|favicon.ico|icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|json|js|css|woff2?)).*)"],
};

export { LANGS };
