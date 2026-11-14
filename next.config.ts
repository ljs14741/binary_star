import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // wedding 과 같은 방식 (next start). 지리 DB·글꼴은 data/ 에서 읽음
    serverExternalPackages: ["maxmind", "@prisma/client"],
    outputFileTracingIncludes: {
        "/**": ["./data/geo/**", "./data/fonts/**"],
    },
    images: { unoptimized: true },
    async redirects() {
        // 브라우저가 습관적으로 찾는 favicon.ico → svg 아이콘
        return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true }];
    },
};

export default nextConfig;
