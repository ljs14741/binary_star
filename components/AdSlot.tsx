// 애드센스 자동광고. 2026-11-15 별말씀에선 분위기 때문에 끔(레이아웃에서 안 씀). 다시 켜려면 app/layout.tsx 에 <AdSenseAuto /> 를 넣으면 됨
import Script from "next/script";
import { ADSENSE_CLIENT, isLocalhost } from "@/lib/site";

export default function AdSenseAuto() {
    if (!ADSENSE_CLIENT || isLocalhost() || process.env.NODE_ENV !== "production") return null;
    return <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" strategy="afterInteractive" />;
}
