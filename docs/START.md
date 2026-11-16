# 별말씀(star) — 다음 세션 시작점 (이 파일만 먼저 읽기. 나머지는 필요할 때)

## 무엇
가입 없이 모르는 사람의 이야기를 읽고 공감하고 내 이야기를 남기는 곳. 4개 언어(ko·en·ja·zh-TW). 첫 화면 = 실시간 3D "밤의 언덕"(바다 위 섬, 하늘에 황도 12궁, 같이 앉은 별 요정). Next.js 16 + TS + Tailwind + Prisma(MySQL `star`) + three.js + ws.
`/home/binary/workspace/binary_star`, 원격 `ljs14741/binary_star` master. **push → Jenkins `binaryworld-star` 자동 배포** → https://star.binaryworld.kr (컨테이너 `star-app`). 커밋·푸시는 Claude 가 `-c user.name=binary -c user.email=jslee@nemosys.kr` 로. 연달아 푸시하면 한 빌드가 실패할 수 있음(다음 빌드가 정리).

## 지금 상태 (2026-11-15 밤, 14차까지 배포. 친구 테스트 중)
- 테스트 54 · lint · build 통과. 개발 서버 `npm run dev`(localhost:3100). 운영은 **클라우드플레어 경유**. 상세 `docs/DEPLOY.md`
- 결정: **Claude API 키 없이 운영**(기본 필터+신고+관리자). 글은 언어 상관없이 다 보임(다른 언어는 "○○로 쓴 이야기" 표시, 브라우저 번역). 화면 언어는 문구만
- 관리자 `/admin`: 처음 한 번 키(compose `STAR_ADMIN_KEY`) → 90일 쿠키. 글 숨기기·신고·제안·이번 달 주제 교체·후원 입력·소원(숨김/고정/지우기)
- 광고 끔. 후원은 카카오페이 버튼(한국어만) + 후원해 주신 분들 목록(`donation`)
- 주제 12칸(`TOPIC_SLOTS`): 11개 열림, 12번째는 첫 사용자 제안 몫. 매달 관리자 버튼으로 공감 1위 제안 ↔ 가장 조용한 주제 교체. 제안은 자동 승격 안 됨
- 언덕: 별명(자동 생성·변경, 요정 머리 위), 감정 표현 6개 + 요정 누르면 하트, 큰 모닥불, 혼자면 그림자 요정, 첫 안내 = 환영 한 장 + 실제 버튼 가리키는 안내 5단계(`components/hill/Tour.tsx`, 대상은 `data-tour`, ? 창에서 다시 보기, 키 `star_intro_seen2`) + 하늘 끌기 힌트, 제목 누르면 **주제 판**(12칸·연필=바로 글쓰기). 첫 화면 아래 방 목록은 뺌(글자 링크만)
- **소원 부두**: 달 버튼/부두 누르면 요정이 부두 끝까지 가서 풍등을 띄움. 하늘엔 빈 시각부터 24시간 + 관리자 고정(사용자 소원 3개 고정, 삭제 금지), 풍등 20개까지 그림·나머지는 목록. 이루어지길·신고·위기 낱말 안내
- 글 쓴 뒤 "하늘에서 내 별 보기"로 돌아오면 그 별자리로 돌고 내 별이 커짐
- 11-16: 검수 필터 손봄(평범한 말 오탐 제거·도박/성매매 광고 낱말·한글 사이 숫자 우회), 웹소켓 브라우저당 3·IP당 30 제한, 폰에서 조금 스크롤해도 주제 제목 줄이 헤더 밑에 붙음, 이야기 검색 설명 = 주제 — 본문 앞부분, 관리자 실시간 언덕 현황, 첫 화면 이번 달 카드 뺌, 언덕 이야기 창에 다른 이야기 보기, DB-IP 출처는 개인정보처리방침으로. 실제 달 모양·12~2월 눈(`components/hill/season.ts`), 요정 모닥불 빛. 하늘 고리 = 별자리 12 + 소원 하늘 1(`WISH_INDEX`=12, 달·풍등은 그 칸에만, 고리를 돌려 그 칸이 부두 방향 az -15. ‹ › 는 들르고 자동 둘러보기는 건너뜀). 크리스마스트리(`components/hill/tree.ts`, 자리 `TREE_POS`, 누르면 반짝·같은 언덕에 `tree` 메시지. 없앨 땐 요청 받아서). 방명록 `/guestbook`(공개·별명·날짜, 신고 3곳이면 숨김, 관리자 답글, 테이블 `guestbook`). 백업은 안 하기로 함(대신 시키지 않은 삭제 금지)
- 14차 상세 `docs/round14.md`, 7~13차 `docs/round7-13.md`, 5·6차 `docs/round5-6.md`

## 다음에 할 일
1. 사용자 몫(나중에): 업타임 모니터 · 안드로이드 실기기 소리·풍등 확인
2. 친구 피드백 반영. 후보: 소원 없는 밤 씨앗 풍등, 신고된 소원만 보기 필터, 저사양이면 풍등 12개로, 풍등 20개 넘으면 "+N" 표시
3. 블로그 글(naver-blog-post 스킬). 나중에 AI 키 켜면 `ANTHROPIC_API_KEY` 만 compose 에

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
- 하늘 위 요소는 폰 헤더에 가림 → 고도 48도 아래. 세로 화면은 카메라가 3.2 앞
- 카메라는 모닥불 둘레를 돎(`ORBIT_R`). 하늘 물체는 `this.sky` 그룹에 넣어야 카메라를 따라감(별 화면좌표 계산 때 `sky.position` 더함). 자리 배정도 불 둘레 원형
- Claude 는 docker 그룹 아님, `sudo` 불가, Caddyfile 은 root 소유(수정은 `Caddyfile.new` 만들어 사용자가 cp+reload). compose(`/home/binary/binaryworld/infra/docker-compose.yml`)는 수정 가능
- 클라우드플레어 뒤라 Caddy `trusted_proxies` 필수(없으면 모든 IP 가 HK). 앱은 X-Forwarded-For 첫 값 사용
- 글 언어 = 쓴 사람의 화면 언어(`app/api/stories/route.ts`). 글자 추정 `detectLangByScript` 는 번역 켤 때 힌트용으로만 남음
- MySQL 비밀번호 탐색 금지

## 파일 지도
`server.ts`(Next+ws) · `lib/realtime/` · `lib/hill.ts` · `lib/admin.ts` · `lib/place.ts` · `lib/geo.ts` · `lib/sound.ts` · `components/hill/`(HillScene·Hill·sky·constellations·scenery·sprites·useHillSocket) · `components/{Dialog,ShareSheet,StoryCard,WriteForm,MyPage,Globe,VisitBeacon}.tsx` · `app/[lang]/admin/` · `messages/*.ts`(4개 언어 키 일치 테스트) · `tests/`
기획 `docs/plan.md`(1~14·17~19 유효) · 배포·클라우드플레어 `docs/DEPLOY.md`
