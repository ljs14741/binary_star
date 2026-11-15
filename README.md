# 별말씀 (가칭, 코드명 star)

주제 방에서 모르는 사람의 이야기를 읽고 공감하고, 내 이야기도 남기는 곳. 가입 없음, 4개 언어(ko·en·ja·zh-TW), 공감 온 도시가 밤의 지구본에 불빛으로 켜짐.
기획서: `docs/plan.md` · **새 세션(AI)은 `docs/START.md` 부터**

## 지금 상태: localhost 출시 전 테스트 단계 (2차 "밤의 언덕" 포함)
- 2026-11-13 2차: 첫 화면이 **실시간 3D 밤의 언덕**(같이 앉아 하늘 보기, 이야기가 별, 매일 22:00 의식). 기획 `docs/plan.md` 14~22, 작업 기록 `docs/history/round3-todo.md`
- 2026-11-14 3·4차: 황도 12궁 360도 하늘 + 이름, 바닷가 풍경(오로라·바다·등대·모닥불·돌고래), 소리, 키보드 걷기, 테마 확인창, 인스타 공유, 쓰기 주제 바꾸기, 내 이야기 머리말·지구본 확대. 기록 `docs/round4-todo.md`
- 배포: `docs/DEPLOY.md` (git push → Jenkins → docker, star.binaryworld.kr)
- Claude API 키 없이 동작(기본 검수만, 번역은 "준비 중" 표시). 키 넣으면 AI 검수 + 자동 번역 켜짐
- DB: `mysql-local` 의 `star` (마이그레이션은 `prisma/migrations`, `star_shadow` 는 `prisma migrate dev` 용 임시 DB)

## 실행
```bash
cd /home/binary/workspace/binary_star
npm install
npm run geo:download     # DB-IP 위치 파일 + OG 글꼴 (한 번만, 이미 받아 둠)
npm run db:migrate       # 스키마 바꿨을 때 (prisma migrate dev). 처음 세팅은 이미 적용됨
npm run db:seed          # 방 7개 + 테스트 이야기 66개(화면에 "테스트" 표시, 별자리 확인용)
npm run dev              # http://localhost:3100 (server.ts: Next + 웹소켓 /ws 같은 포트)
```

## 밤의 언덕 확인 (4차, 2026-11-14 낮 수정판)
1. `http://localhost:3100/ko` → 처음이면 안내 3장 → **황도 12궁 별자리가 카메라 둘레 360도에**(양·황소·쌍둥이·게·사자·처녀·천칭·전갈·궁수·염소·물병·물고기). 주제 방이 붙은 별자리(7개)는 이야기 별로 채워지고, 없는 별자리도 흐리게 모양이 떠 있음. 모양 아래 글자는 주제 이름이 주, 그 아래 별자리 이름(♈ 양자리)은 작고 흐리게
2. 하늘을 끌어서 돌아봄(관성). 위 12칸 점 띠에서 지금 보는 자리가 표시되고, 점을 누르면 그쪽으로 돎. ‹ › 는 주제 있는 다음 별자리. PC 는 Shift+←→
3. 고른 별자리만 밝고 크게. 5.5초마다 별이 하나씩 밝아지고 하늘 아래 카드에 첫 문장. 다 보여 주면 주제 있는 다음 별자리로 넘어감. 주제 없는 별자리는 "주제 제안하기" 카드
4. 풍경: 정면 바다·등대(오른쪽, 7초에 한 바퀴), 왼쪽 뒤(염소~물고기 쪽) 바다 위 오로라, 언덕 가운데 모닥불, 25~45초마다 돌고래
5. 별 요정: 나는 노랑. 땅을 누르면 걸어감. PC 는 방향키·WASD 를 누르는 동안만 걷고 떼면 멈춤
6. 소리: 첫 터치·클릭·키 뒤 배경(화음·파도·모닥불·종) 켜짐. 오른쪽 위 스피커로 끄기. 공감·새 별·별똥별·의식·별자리 고르기 효과음
7. 별·카드 → "하늘의 이야기" 시트(긴 글은 "더 보기"). 카드 아래 깃발+"신고" = 신고, 공유 = 카카오톡·인스타그램(세로 카드 이미지)·X·Threads·링크 복사·기기 공유창
8. "나도 한마디" → 쓰기 화면 위 주제 칩으로 다른 주제로 바로 바꿀 수 있음. 올린 뒤 10분 안에만 수정·삭제(화면에 안내)
9. 브라우저 B(시크릿, 먼저 `/api/dev/geo?set=JP,Tokyo,35.7,139.7`)로 같이 들어오면 서로 보임. 공감하면 하트 + 빛 알갱이, 새 글은 그 별자리의 빈 자리를 채움
10. 의식: `/api/dev/daily` → 큰 별똥별 뒤 "오늘의 이야기". `?final=1` 은 이번 달 1위
11. 내 이야기(`/ko/me/{token}`): "내 이야기 N개에 공감 M개" + 공감 온 도시 한 줄 + 지구본(불빛이 모인 곳으로 자동 확대. 한국만이면 한국이 크게). 확인창은 전부 테마 창(`components/Dialog.tsx`)
- 구조: `server.ts`(Next+ws 같은 포트, `lib/load-env` 가 첫 import) · `lib/realtime/`(hub·protocol·emit) · `lib/hill.ts`(방별 별 10개·오늘의 이야기) · `lib/sound.ts`(WebAudio 합성) · `components/hill/`(HillScene three.js · Hill 화면 · sky 고리 배치 · constellations 12궁 · scenery 풍경 · sprites 요정·글자 · 소켓 훅) · `/api/hill/*` · `/[lang]/s/[id]/story-image`(인스타용 세로 카드)
- 디버그(개발 모드): `window.__hill.cells()` 12궁 배정, `starScreenPositions()`, `mePos()`, `viewAz()`, `goTo(i)`
- 작업 기록 `docs/round4-todo.md`(3·4차), `docs/history/`(1·2차)

## 확인 순서 (기획서 12. 완료 기준)
1. **8개 화면**: `http://localhost:3100/` → 브라우저 언어로 이동. 오른쪽 위 언어 메뉴로 ko/en/ja/zh-TW 전환
   - 홈(방 목록 + 이번 달 주제) → 방(릴스식 넘기기, 긴 글 "더 보기") → 나도 한마디 → 남긴 뒤 화면 → 내 이야기(`/ko/me/{token}`, 지구본) → 1위 보기(전체/나이대/나라) → `/ko/featured` → `/ko/propose`
2. **쓰기 → 공감 → 지구본**
   - 브라우저 A: 아무 방에서 글 쓰기 → "친구에게 공감 해 줘 보내기"로 링크 복사
   - 브라우저 B(시크릿 창): 먼저 `http://localhost:3100/api/dev/geo?set=JP,Tokyo,35.7,139.7` 열어 위치를 도쿄로 흉내 → 복사한 링크 열기(그 카드가 맨 위) → 공감
   - 브라우저 A: 헤더 "내 이야기" → "공감 +1", 지구본에 도쿄 불빛, 도시 목록에 Tokyo
   - localhost 는 IP 위치가 없어서 `/api/dev/geo?set=나라,도시,위도,경도` 로 흉내 냄 (개발 모드에서만 동작). `?clear=1` 로 해제
3. **공유 링크·OG**: `/ko/s/{id}` 로 들어오면 그 카드부터. OG 이미지는 `/ko/s/{id}/opengraph-image`
4. **검수**: 전화번호·이메일 → 자동 가림 / `https://…` → 거부 / 욕설 → 거부 / "죽고 싶다" → 나에게만 보임 + 상담 안내
5. **신고**: 시크릿 창 3개에서 같은 카드를 각각 신고 → 자동 숨김 (`/api/dev/geo` 안 해도 됨. 쿠키가 다르면 다른 사람)
6. **주제 제안**: `/ko/propose` 에서 제안 → 공감 100개면 방 생성 (테스트에선 기준 5로 낮춰 확인함)
7. **시드 이야기 주인 화면**: `data/seed-owner-token.txt` 의 토큰으로 `/ko/me/{token}` → 지구본에 16개 도시 불빛
8. **출시 전 테스트 데이터 삭제**: `npm run db:clear-seed`

## 자동 테스트
```bash
npm test        # vitest 38개: 언덕 허브(배정·정원·한 자리·몸짓·이야기 이벤트·의식), 하늘 별 규칙·별자리 배치, 검수·개인정보 가림·위험 낱말, 언어 사전 키 일치·언어 감지, 방문자 키,
                #   공감 1인 1회·내 글 불가·지구본 좌표, 신고 3회 숨김, 피드 순서, 제안 → 방 생성,
                #   별명 검수, 수정·삭제 10분 제한, 내리기/다시 올리기, IP 대역 공감 제한
npm run lint    # ESLint
npm run build   # 프로덕션 빌드
```
DB 테스트는 `star` DB 에 `__test_room__` 방을 만들고 끝나면 지움.

## 남은 것 (사용자 결정·권한 필요)
| 항목 | 할 일 |
|---|---|
| Claude API 키 | `.env.local` 의 `ANTHROPIC_API_KEY=` 채우고 재시작 → AI 검수 + 이야기 자동 번역 켜짐 (모델: claude-haiku-4-5, `STAR_AI_MODEL` 로 변경 가능) |
| 카카오 공유 | 카카오 개발자 콘솔 → 앱 → 플랫폼(Web)에 `http://localhost:3100` 과 배포 도메인 등록. 안 되면 자동으로 "링크 복사"로 대체됨 |
| 백업 | `scripts/backup.sh` 를 cron 에 등록 (도커 권한 필요: `sudo usermod -aG docker binary`) |
| 서비스 이름 | `.env.local` 의 `NEXT_PUBLIC_SITE_NAME_KO / _EN` (코드·주소는 `star` 고정) |
| 배포 | Dockerfile 준비됨(포트 3100, `tsx server.ts`). Caddy 에 `star.binaryworld.kr` 한 줄(웹소켓은 같은 reverse_proxy 로 자동 업그레이드), docker-compose 에 서비스 추가, Jenkins 잡 추가 → 그때 `NEXT_PUBLIC_SITE_URL` 을 배포 주소로 |
| 배포 전 | `npm run db:clear-seed`, DB-IP 파일은 매달 갱신(`npm run geo:download`, 출처 표기는 푸터에 있음). 컨테이너는 시작 때 `prisma migrate deploy` 를 돌림 |

## 구조
```
app/
  layout.tsx                 html lang · 하늘 배경 · GA
  [lang]/                    언어별 주소 (/ko /en /ja /zh-TW)
    page.tsx                 홈: 이번 달 주제 배너 + 방 목록
    room/[slug]/page.tsx     방: 릴스식 넘기기 (StorySwiper)
    room/[slug]/write        나도 한마디 (WriteForm) → 남긴 뒤 화면
    room/[slug]/top          1위: 전체 / 나이대별 / 나라별
    s/[id]/page.tsx          공유 링크: 그 카드 먼저 (+ opengraph-image.tsx 자동 OG)
    me/[token]/page.tsx      내 이야기: 공감 +N · 3D 지구본(Globe) · 도시 목록
    featured · propose · about · privacy · terms
  api/                       stories(피드·작성) · empathy · report · translation · me · proposals · dev/geo
  robots.ts · sitemap.ts     언어별 hreflang 포함
lib/
  i18n/ + messages/*.ts      화면 글자 4개 언어 (키는 ko.ts 기준)
  moderation.ts              금칙어(4개 언어)·개인정보 가림·URL 금지·위험 낱말
  ai.ts · translate.ts       Claude 선택 연동 (키 없으면 null)
  voter.ts · crypto.ts       쿠키+IP 해시 voter_key, owner_token 해시
  geo.ts                     DB-IP mmdb → 나라·도시·좌표(소수 1자리). 폴백 Accept-Language
  stories.ts · rooms.ts · proposals.ts   서비스 계층 (Prisma)
components/                  StoryCard · StorySwiper · EmpathyButton · ShareSheet(카카오/네이티브/복사) · Globe(three.js) · …
prisma/                      schema.prisma (MySQL, utf8mb4) · migrations/
scripts/                     seed · clear-seed · download-geo · backup
tests/                       vitest
```

## 설정 (.env.local)
`.env.example` 참고. 비밀번호·키는 `.env.local` 에만 (gitignore).

## 규칙 요약 (기획서 3~7)
- 공감 1인 1회(취소 가능), 내 글 불가, 같은 IP 대역 이야기당 하루 3회. 신고 서로 다른 3명 → 숨김. "오르는 중" = 24시간 공감 3개 이상
- 작성 제한: 하루 이야기 10개·제안 3개, 공감 분당 30회
- 상태: pending → public / private(위험 낱말·AI 판정, 본인만) / withdrawn(본인이 내림) / hidden(신고) / removed
- 저장하는 위치 정보: 나라 코드·도시 이름·도시 중심 좌표(소수 1자리). IP 원문 없음
