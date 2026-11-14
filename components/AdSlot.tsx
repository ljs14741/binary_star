// 애드센스 자동광고. 프로덕션 + localhost 아닐 때만 스크립트 삽입 (광고 위치는 구글이 자동 결정)
import Script from "next/script";
import { ADSENSE_CLIENT, isLocalhost } from "@/lib/site";

export default function AdSenseAuto() {
    if (!ADSENSE_CLIENT || isLocalhost() || process.env.NODE_ENV !== "production") return null;
    return <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" strategy="afterInteractive" />;
}
