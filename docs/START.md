# 별말씀(star) — 다음 세션 시작점 (이 파일만 먼저 읽기. 나머지는 필요할 때)

## 무엇
가입 없이 모르는 사람의 이야기를 읽고 공감하고 내 이야기를 남기는 곳. 4개 언어(ko·en·ja·zh-TW). 첫 화면 = 실시간 3D "밤의 언덕"(바다 위 섬, 하늘에 황도 12궁, 같이 앉아 있는 별 요정들). Next.js 16 + TS + Tailwind + Prisma(MySQL `star`) + three.js + ws.
위치 `/home/binary/workspace/binary_star`. git 저장소(원격 `ljs14741/binary_star`, master). push → Jenkins → docker. 절차·남은 수작업은 `docs/DEPLOY.md`. 푸시는 사용자가 함.

## 지금 상태 (2026-11-14 저녁, 5차 폰 피드백 반영. star.binaryworld.kr 배포됨, push 하면 Jenkins 가 자동 배포)
- 테스트 38 · lint · build 통과. 개발 서버 `npm run dev` (localhost:3100, 사용자는 LAN 192.168.219.x 로도 봄)
- 하늘: 황도 12궁이 360도 고리에 늘 전부(주제 있는 7개 = 이야기 별, 없는 5개 = 흐리게 + "주제 제안하기"). 끌어서 돌아봄(관성), 위 12궁 띠로 위치. 방↔별자리 배정은 `components/hill/constellations.ts`
- 풍경: 정면 바다·등대, 왼쪽 뒤 오로라, 모닥불, 가끔 돌고래, 달은 정면 왼쪽 바다 위 낮게(az -9·elev 9.5). 소리는 효과음만(WebAudio 합성, `lib/sound.ts`). 배경음·별자리 넘김 소리는 폰에서 이상해서 뺌(5차)
- 조작(5차): 섬이나 내 요정을 잡고 끌면 걷기(손가락 따라감, 발밑 고리 표시), 하늘을 끌면 돌아보기. 땅 누르기가 별·별자리 판정보다 우선. 조작 뒤 20초는 별자리 자동 넘김 안 함(`IDLE_BEFORE_AUTO`). 내 요정 누르기·손 버튼 → 손 흔들기(몸짓은 서버 방송, 합류한 사람도 자동으로 흔듦). 폰에선 문장 카드가 섬 아래 바다 자리(`bottom-[6.75rem]`), PC 는 가운데. 접속 인원은 늘 숫자로 표시
- 공유: 카카오·인스타(세로 카드 `/[lang]/s/[id]/story-image`)·X·Threads·LINE·링크 복사. 확인창은 테마 창(`components/Dialog.tsx`). 쓰기 화면에 주제 칩. 수정·삭제는 올린 뒤 10분(화면에 안내). 내 이야기: 머리말 + 지구본(불빛 모인 곳으로 자동 확대)
- 사용자가 아직 실물로 확인 안 한 것: 폰에서 인스타 파일 공유, 폰 fps, 12궁 모양, 5차 조작감(끌어 걷기·손 흔들기). 사용자가 "은영"이라는 이름을 봤다는데 DB·코드 어디에도 없음(어디서 봤는지 물어볼 것)

## 다음에 할 일 (사용자 피드백 받고 나서)
1. 사용자 실물 피드백 반영 (위 "확인 안 한 것")
2. 아직 안 한 것: Claude API 키(compose `ANTHROPIC_API_KEY` → AI 검수·번역 켜짐), 카카오 도메인 등록, 도커 그룹, 정식 오픈 전 `npm run db:clear-seed`. 배포 체크리스트는 `docs/DEPLOY.md`
3. 사용자 방침: "반응 보고 고치지 말고 처음부터 제대로". 캐릭터·조작은 내 추천대로 가되 사용자가 실물 보고 말해 줌

## 확인 방법
- 사람이 볼 땐 `README.md` "밤의 언덕 확인" 1~11
- 헤드리스: playwright-core(`~/.claude/skills/web-promo-video/tools/node_modules`) + `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` + `--use-angle=swiftshader`. 개발 모드 디버그 `window.__hill.cells()/starScreenPositions()/mePos()/viewAz()/goTo(i)`. 스크린샷은 `.tmp/hill/`
- 브라우저 B 는 시크릿 + 먼저 `/api/dev/geo?set=JP,Tokyo,35.7,139.7`. 의식 강제 `/api/dev/daily`. 같은 IP 는 이야기당 하루 3번 공감 제한
- 시드: `npm run db:seed`(방 7 + 테스트 글, 긴 글 2개 포함). 주인 토큰 `data/seed-owner-token.txt` → `/ko/me/{token}`

## 함정 (꼭 지킬 것)
- `server.ts` 는 `import "./lib/load-env"` 가 **첫 import** (아니면 voter_key 가 어긋나 "내가 공감"을 못 알아봄)
- Next 16 커스텀 서버: decoy httpServer + 내부 `upgradeHandler` 구조 바꾸지 말 것. `lib/realtime/*` 같은 서버 코드는 dev 서버 재시작 필요
- React lint: 렌더 중 `useRef.current` 읽기·컴포넌트 정의 금지 → `useState(() => new X())`, 모듈 수준 컴포넌트
- 하늘 위 요소는 폰 헤더(위 ~17도)에 가림 → 고도 48도 아래
- 시드 글만 추가할 땐 `.tmp/` 안에 tsx 두고 `../lib/prisma` import (scratchpad 에선 dotenv 못 찾음)
- MySQL 비밀번호 탐색 금지

## 파일 지도
`server.ts`(Next+ws 같은 포트) · `lib/realtime/`(hub·protocol·emit, FIRE_POS) · `lib/hill.ts`(방별 별 10개·오늘의 이야기) · `lib/sound.ts` · `components/hill/`(HillScene three.js · Hill 화면 · sky 고리 배치 · constellations 12궁 · scenery 풍경 · sprites 요정·글자 · useHillSocket) · `components/{Dialog,ShareSheet,StoryCard,WriteForm,MyPage,Globe}.tsx` · `messages/*.ts`(키는 ko 기준, 4개 언어 키 일치 테스트 있음) · `tests/`
기획 `docs/plan.md`(1~14·17~19 유효, 15~16 은 20~22 로 대체) · 작업 기록 `docs/round4-todo.md`(3·4차), `docs/history/`(1·2차)
