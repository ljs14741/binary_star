import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // wedding 과 같은 방식 (next start). 지리 DB·글꼴은 data/ 에서 읽음
    serverExternalPackages: ["maxmind", "@prisma/client"],
    outputFileTracingIncludes: {
        "/**": ["./data/geo/**", "./data/fonts/**"],
    },
    images: { unoptimized: true },
    // 기본 보안 헤더: 다른 사이트가 iframe 으로 감싸 공감·신고 버튼을 몰래 누르게 하는 것 막기, MIME 추측 막기
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
    async redirects() {
        // 브라우저가 습관적으로 찾는 favicon.ico → svg 아이콘
        return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true }];
    },
};

export default nextConfig;
