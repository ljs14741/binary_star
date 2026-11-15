# wedding 과 같은 방식. 배포는 나중 (지금은 localhost 테스트 단계)
# ===== Stage 1: 의존성 설치 및 빌드 =====
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=https://star.binaryworld.kr
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=G-0TSFJBQ41N
ARG NEXT_PUBLIC_KAKAO_JS_KEY=a0f0937c4b5e7f955e3521725009bfd7
ARG NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-6890085609044109
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_KAKAO_JS_KEY=$NEXT_PUBLIC_KAKAO_JS_KEY
ENV NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts && npx prisma generate

COPY . .
# 지리 DB·OG 글꼴 (빌드 때 받음. 실패해도 빌드는 계속 → 위치는 Accept-Language 로만 추정)
RUN bash scripts/download-geo.sh || true
RUN npm run build

# ===== Stage 2: 실행 =====
FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Seoul
ENV HOSTNAME=0.0.0.0
ENV PORT=3100

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/data ./data
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.ts /app/tsconfig.json ./
COPY --from=builder /app/lib ./lib

EXPOSE 3100

# 마이그레이션 적용 → 방 6개+이번 달 주제 방 보장 → 시작
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/seed.ts --rooms-only && npm run start"]
