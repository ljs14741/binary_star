# 7~13차 작업 기록 (2026-11-15, 친구 테스트 직전). 필요할 때만 읽기

- 7차 이름표: 첫 방문자 "별자리에 주제가 달린 게 뭐냐" → 하늘 이름표는 주제가 주, 별자리 이름은 아래 작고 흐리게. 위 헤더는 주제만, 12궁 띠는 점. 달은 az -15·고도 33(`MOON_AZ/MOON_ELEV`), 절반 크기, 바다 달빛 길 같은 방위
- 8차: 홈·방 공유 썸네일 `app/[lang]/opengraph-image.tsx`, 오류 화면 `app/[lang]/error.tsx`. AI 키 없을 때 번역 약속 문구 분기(`anon_notice_local`·`after_public_local`·`about_body_local`, `aiEnabled()`)
- 9차 관리자: `/ko/admin?key=STAR_ADMIN_KEY`. `lib/admin.ts`(통계·조치), `app/[lang]/admin/`, `app/api/admin/story`(hide/unhide/remove). 방문자는 `visit_day` 테이블 + `components/VisitBeacon.tsx`(세션당 1번 `POST /api/visit`). 시드 68·테스트 글 5 삭제함
- 10차 클라우드플레어: `docs/DEPLOY.md` 참고. Caddyfile 전역 `trusted_proxies` 없으면 모든 방문자가 클라우드플레어 IP(HK)로 보임
- 11차 지역 이름: DB-IP 가 한국을 동 단위 영문으로 줘서 한국·일본은 시도 단위로 저장(`lib/place.ts` pickPlace). 화면엔 안 보여 줌
- 12차 지역 칩(철회): IP 추정이 안양→용산처럼 틀려 쓰는 사람이 고르게 했다가, 선택 부담·PC 가로 스크롤 문제로 뺌
- 13차: 화면엔 나라만. 지구본은 나라마다 불빛 하나(공감 수로 크기, 좌표는 공감 평균) + 물결 2겹(`Globe.tsx` ringTexture). PC 에선 주제 칩 줄바꿈. 인트로 2장은 "별들은 '첫사랑에게'처럼 주제별로 모여 있어요"
- 언어 감지: 로마자 8글자 미만이면 화면 언어 따름(`detectLangByScript`). "c" 한 글자 글이 영어로 잡혀 한국어 화면에서 안 보였던 일
- 관리자 키·클라우드플레어 네임서버·Caddy reload 는 사용자가 함. git 작성자는 `-c user.name=binary -c user.email=jslee@nemosys.kr`(저장소에 설정 없음)
