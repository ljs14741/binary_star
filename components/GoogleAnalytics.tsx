"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-0TSFJBQ41N";

// localhost 에선 수집 안 함. 관리자 페이지도 안 실음 (주소에 키가 있고, 운영자 접속이 방문 통계에 섞이지 않게)
export default function GoogleAnalytics() {
    const pathname = usePathname() || "/";
    if (/^\/[^/]+\/admin(\/|$)/.test(pathname)) return null;
    if (!GA_ID || typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname)) return null;
    if (process.env.NODE_ENV !== "production") return null;
    return (
        <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
`}</Script>
        </>
    );
}
