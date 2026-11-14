"use client";

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-0TSFJBQ41N";

// localhost 에선 수집 안 함
export default function GoogleAnalytics() {
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
