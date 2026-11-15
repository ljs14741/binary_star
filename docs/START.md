# 별말씀(star) — 다음 세션 시작점 (이 파일만 먼저 읽기. 나머지는 필요할 때)

## 무엇
가입 없이 모르는 사람의 이야기를 읽고 공감하고 내 이야기를 남기는 곳. 4개 언어(ko·en·ja·zh-TW). 첫 화면 = 실시간 3D "밤의 언덕"(바다 위 섬, 하늘에 황도 12궁, 같이 앉은 별 요정). Next.js 16 + TS + Tailwind + Prisma(MySQL `star`) + three.js + ws.
`/home/binary/workspace/binary_star`, 원격 `ljs14741/binary_star` master. **push → Jenkins `binaryworld-star` 자동 배포** → https://star.binaryworld.kr (컨테이너 `star-app`). 커밋·푸시는 Claude 가 `-c user.name=binary -c user.email=jslee@nemosys.kr` 로. 연달아 푸시하면 한 빌드가 실패할 수 있음(다음 빌드가 정리).

## 지금 상태 (2026-11-15 저녁, 13차까지 배포. 친구 테스트 직전)
- 테스트 39 · lint · build 통과. 개발 서버 `npm run dev`(localhost:3100). 운영은 **클라우드플레어 경유**(무료, 집 IP 숨김, 정적 캐시). 상세 `docs/DEPLOY.md`
- 결정: **Claude API 키 없이 운영** → 검수는 기본 필터+신고+관리자 페이지, 번역 없음 → 글은 언어 상관없이 다 보임(내 언어 글 위주, 다른 언어는 원문+"○○로 쓴 이야기" 표시, 브라우저 번역에 맡김). 화면 언어는 사이트 문구만. 번역 약속 문구는 `aiEnabled()` 로 분기돼 안 나옴
- 관리자 페이지 `/admin`: 처음 한 번 키 입력 → 90일 쿠키(`star_admin`, 키 해시). 키는 compose `STAR_ADMIN_KEY`·`.env.local`. 예전 `?key=` 주소도 됨: 접속·방문자·글·공감·방별·최근 글 숨기기/내리기·신고·제안
- 광고 끔(2026-11-15, 분위기). 대신 언덕 버튼 줄에 후원(카카오페이, game 과 같은 링크·QR, 한국어 화면만). 후원 내역은 관리자 페이지에서 직접 입력 → 후원 창에 이름 가려 공개(`donation` 표)
- 화면엔 나라만(도시 없음). 지구본은 나라마다 불빛 하나 + 물결. 하늘 이름표는 주제가 주, 별자리 이름은 작게
- DB: 시드·테스트 글 전부 삭제됨. 사용자가 방마다 진짜 글 3편(이번 달 주제 5편) 쓰는 중
- 7~13차 상세는 `docs/round7-13.md`, 5·6차 `docs/round5-6.md`, 3·4차 `docs/round4-todo.md`

## 주제 운영 (2026-11-15 결정)
- 주제는 하늘 별자리처럼 최대 12개(`TOPIC_SLOTS`). 11개 열림, 12번째는 첫 사용자 제안 몫(정의는 `scripts/seed.ts`, 별자리 매칭은 `constellations.ts` BY_SLUG). 제안은 공감이 많아도 자동으로 방이 안 됨
- 매달 관리자 페이지 "이번 달 주제 교체" 버튼: 공감 1위 제안 ↔ 최근 30일 가장 조용한 주제(연 지 30일 안 된 건 유예). 내려간 주제는 `status=closed` 로 글은 남고 읽기만

## 다음에 할 일
1. 친구 테스트 피드백 반영 (폰 실물: 요정·끌어 걷기·손 흔들기·인스타 공유·fps·지구본 물결 느낌)
2. 하늘 12칸 대비: "이번 달 주제"를 달마다 돌리고 지난 방은 보관함(읽기만, 하늘에서 내림). 13번째 방은 지금 하늘에 못 뜸(`assignRooms`)
3. 백업 cron: 사용자가 `sudo usermod -aG docker binary` 후 `scripts/backup.sh` 를 cron 에
4. 블로그 글(naver-blog-post 스킬) · 애드센스 콘솔에서 star 서브도메인 확인
5. 나중에 AI 키 켜면 `ANTHROPIC_API_KEY` 만 compose 에 (검수·번역·문구 자동 복귀)

## 확인 방법
- 운영 확인은 클라우드플레어 IP 로: `ip=$(dig +short A star.binaryworld.kr @peter.ns.cloudflare.com | head -1); curl --resolve star.binaryworld.kr:443:$ip https://star.binaryworld.kr/ko` (이 PC 에선 공인 IP 헤어핀 안 됨. 시스템 DNS 캐시가 옛 IP 를 줄 수 있음)
- 헤드리스 캡처: playwright-core(`~/.claude/skills/web-promo-video/tools/node_modules`) + `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` + `--use-angle=swiftshader`, `waitUntil: "load"`(networkidle 은 dev 에서 타임아웃). 스크립트·스크린샷은 `.tmp/`(git 밖). 개발 디버그 `window.__hill.*`
- 브라우저 B 는 시크릿 + `/api/dev/geo?set=JP,Tokyo,35.7,139.7`. 의식 강제 `/api/dev/daily`. 시드 `npm run db:seed`(출시 전 `db:clear-seed`)
- 임시 글은 `.tmp/*.ts` 에서 `../lib/prisma` 로 만들고 끝나면 꼭 삭제 (story 에 lat/lng 없음, empathy 에 있음)

## 함정 (꼭 지킬 것)
- `server.ts` 는 `import "./lib/load-env"` 가 **첫 import**
- Next 16 커스텀 서버: decoy httpServer + `upgradeHandler` 구조 바꾸지 말 것. 서버 코드·Prisma 스키마 바꾸면 dev 서버 재시작(`ps -eo pid,user,args` 로 binary 소유 `tsx server.ts` 만 kill. `pkill -f` 는 자기 셸까지 죽임)
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
