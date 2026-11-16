# 별말씀(star) — 다음 세션 시작점 (이 파일만 먼저 읽기. 나머지는 필요할 때)

## 무엇
가입 없이 모르는 사람의 이야기를 읽고 공감하고 내 이야기를 남기는 곳. 4개 언어(ko·en·ja·zh-TW). 첫 화면 = 실시간 3D "밤의 언덕"(바다 위 섬, 하늘에 황도 12궁, 같이 앉은 별 요정). Next.js 16 + TS + Tailwind + Prisma(MySQL `star`) + three.js + ws.
`/home/binary/workspace/binary_star`, 원격 `ljs14741/binary_star` master. **push → Jenkins `binaryworld-star` 자동 배포** → https://star.binaryworld.kr (컨테이너 `star-app`). 커밋·푸시는 Claude 가 `-c user.name=binary -c user.email=jslee@nemosys.kr` 로. 연달아 푸시하면 한 빌드가 실패할 수 있음(다음 빌드가 정리).

## 지금 상태 (2026-11-16 밤, 홍보 직전)
- 테스트 61 · lint · build 통과. 개발 서버 `npm run dev`(localhost:3100). 운영은 **클라우드플레어 경유**. 상세 `docs/DEPLOY.md`
- 결정: **Claude API 키 없이 운영**(기본 필터+신고+관리자). 글은 언어 상관없이 다 보임. **백업 안 함 → 시키지 않은 삭제·파괴적 DB 작업 금지**
- 관리자 `/admin`(키 → 90일 쿠키): 실시간 언덕 현황·글/소원/방명록 숨기기·답글·주제 교체·후원
- 첫 화면 3D 섬(무인도라고 부름): 하늘 고리 = 별자리 12 + 🌙소원 하늘 1(`WISH_INDEX`=12, 달·풍등은 그 칸에만, 부두 방향 az -15). 주제 판(제목 누르면), 감정 표현, 하트, 소원 부두→풍등, 크리스마스트리(`tree.ts`·`TREE_POS`, 없앨 땐 요청 받아서), 실제 달 모양·12~2월 눈(`season.ts`)
- 주제 배치 `constellations.ts` `BY_SLUG`: 2번째 = 엄마·아빠에게, 빈 별자리 = 6번째(처녀자리, 첫 사용자 제안 몫)
- 첫 안내 = 환영 한 장 + 버튼 가리키는 5단계(`Tour.tsx`, `data-tour`, ? 창에서 다시 보기)
- 방명록 `/guestbook`(테이블 `guestbook`). 검수 `lib/moderation.ts`(오탐 예외·광고 낱말·한글 사이 숫자 우회, 테스트에 사례). 웹소켓 브라우저당 3·IP당 30
- 글꼴 Pretendard(CDN, 한국어·영어). 본문 명조는 사용자가 별로라 해서 안 씀
- 운영자 첫 이야기 7개(id 2232~2238, 공감 10~17, `is_seed` 아님). 테스트 글 1423 숨김. 사용자 소원(id 23·24·36) 건드리지 않기
- 네이버 소유확인 파일 `public/naver7f7b….html`. 서치어드바이저는 **https** 로 등록해야 robots 검사 통과(http→https 308 을 네이버가 안 따라감)
- 홍보: 영상·썸네일·캡션 `/home/binary/star_promo/`(사용자 받기 `scp -r binary@192.168.219.150:/home/binary/star_promo .`), 촬영 작업 `/home/binary/promo_star/work/`. 블로그 원고 `/home/binary/blog_posts/2026-11-16_star/`(원고함 아티팩트). 키워드 '별말씀 사이트'
- 차수별 상세 `docs/round14.md` · `round7-13.md` · `round5-6.md`

## 다음에 할 일
1. 사용자: 블로그 예약 발행(오전 9시) → 그날 밤 릴스. 발행 주소 받으면 원고함 "발행함" + `analytics-mcp/EXPERIMENTS.md` 기록. 업타임 모니터·안드로이드 실기기 확인은 나중에
2. 친구·방문자 피드백 반영. 후보: 소원 없는 밤 씨앗 풍등, 저사양이면 풍등 12개로, 풍등 20개 넘으면 "+N"
3. 나중에 AI 키 켜면 `ANTHROPIC_API_KEY` 만 compose 에

## 확인 방법
- 운영 확인은 클라우드플레어 IP 로: `ip=$(dig +short A star.binaryworld.kr @peter.ns.cloudflare.com | head -1); curl --resolve star.binaryworld.kr:443:$ip https://star.binaryworld.kr/ko` (이 PC 에선 공인 IP 헤어핀 안 됨. 시스템 DNS 캐시가 옛 IP 를 줄 수 있음)
- 헤드리스 캡처: playwright-core(`~/.claude/skills/web-promo-video/tools/node_modules`) + `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` + `--use-angle=swiftshader`, `waitUntil: "load"`(networkidle 은 dev 에서 타임아웃). 스크립트·스크린샷은 `.tmp/`(git 밖). 개발 디버그 `window.__hill.*`
- 브라우저 B 는 시크릿 + `/api/dev/geo?set=JP,Tokyo,35.7,139.7`. 의식 강제 `/api/dev/daily`. 시드 `npm run db:seed`(출시 전 `db:clear-seed`)
- 임시 글·소원은 `.tmp/*.ts`(첫 줄 `import "../lib/load-env"`, async main, `../lib/prisma`)로 만들고 끝나면 꼭 삭제. 사용자 소원(id 23·24·36)은 건드리지 않기
- 운영 배포 확인: push 뒤 `ps -o lstart= -p $(ps -eo pid,args | grep "[s]h -c NODE_ENV=production" | awk '{print $1}')` 가 커밋 시각보다 뒤면 새 코드. 보통 2~3분

## 함정 (꼭 지킬 것)
- `server.ts` 는 `import "./lib/load-env"` 가 **첫 import**
- Next 16 커스텀 서버: decoy httpServer + `upgradeHandler` 구조 바꾸지 말 것. 서버 코드·Prisma 스키마 바꾸면 dev 서버 재시작: `ps -eo pid,user,args | grep "[n]ode .*tsx server.ts"` 로 **binary 소유 node 만** kill. `pkill -f`·`pgrep -f "tsx server.ts"` 는 자기 셸까지 잡음(실제로 한 번 죽음). root 소유는 운영 컨테이너
- 폰에서 캔버스를 누른 뒤 창이 바로 닫히면 유령 click(`round14.md`). 헤드리스 검증은 `touchscreen.tap` 으로
- Prisma 스키마 바꾸면 migration SQL 을 손으로 쓰고 `npx prisma migrate deploy && npx prisma generate`(dev DB = 운영 DB, 추가만 할 것)
- React lint: 렌더 중 `useRef.current` 읽기·컴포넌트 정의 금지
- 하늘 위 요소는 폰 헤더에 가림 → 고도 48도 아래. 세로 화면은 카메라가 3.2 앞, 부두에 서면 더 다가감(이름표는 화면 24px 상한)
- 트리 몸통은 불투명(alphaTest)으로 깊이를 씀 → 뒤 요정만 가려짐. 투명+renderOrder 로 바꾸면 앞 요정까지 덮음
- 카메라는 모닥불 둘레를 돎(`ORBIT_R`). 하늘 물체는 `this.sky` 그룹에 넣어야 카메라를 따라감(별 화면좌표 계산 때 `sky.position` 더함). 자리 배정도 불 둘레 원형
- Claude 는 docker 그룹 아님, `sudo` 불가, Caddyfile 은 root 소유(수정은 `Caddyfile.new` 만들어 사용자가 cp+reload). compose(`/home/binary/binaryworld/infra/docker-compose.yml`)는 수정 가능
- 클라우드플레어 뒤라 Caddy `trusted_proxies` 필수(없으면 모든 IP 가 HK). 앱은 X-Forwarded-For 첫 값 사용
- 글 언어 = 쓴 사람의 화면 언어(`app/api/stories/route.ts`). 글자 추정 `detectLangByScript` 는 번역 켤 때 힌트용으로만 남음
- MySQL 비밀번호 탐색 금지

## 파일 지도
`server.ts`(Next+ws) · `lib/realtime/` · `lib/hill.ts` · `lib/guestbook.ts` · `lib/moderation.ts` · `lib/admin.ts` · `lib/place.ts` · `lib/geo.ts` · `lib/sound.ts` · `components/hill/`(HillScene·Hill·sky·constellations·scenery·sprites·useHillSocket) · `components/{Dialog,ShareSheet,StoryCard,WriteForm,MyPage,Globe,VisitBeacon}.tsx` · `app/[lang]/admin/` · `messages/*.ts`(4개 언어 키 일치 테스트) · `tests/`
기획 `docs/plan.md`(1~14·17~19 유효) · 배포·클라우드플레어 `docs/DEPLOY.md`
