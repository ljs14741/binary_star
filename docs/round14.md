# 14차 (2026-11-15 밤) 상세 — 소원 부두·주제 판·글 쓴 뒤 내 별. 필요할 때만 읽기

## 소원 부두
- 자리·길이 `protocol.ts` `WISH_DOCK`(모닥불 왼쪽 앞, 달 방위 -15도, 길이 5.4). 서버 `clampHill` 이 부두 위 좌표는 언덕 범위 밖이어도 허용. 요정 높이 `groundY`(부두 위면 판자 높이)
- `goWish()`: 누르자마자 카메라가 달로 돌고 `onWishGo`(안내 토스트) → 입구(WISH_SPOT)까지 → 끝까지 2단계(`wishPending` 1→2, 바다 위로 질러가지 않게). 부두로 갈 땐 `WISH_RUN` 배 빠름. 부두 위에 서면 카메라가 `DOCK_CAM_FWD` 만큼 다가감(`dockNear`)
- 끝에 서면 `onWishArrive` → `WishCompose`(위쪽 고정 창, 16px 입력). 빌면 `launchLantern` + `{t:"lantern"}` + 소리 `lantern`(남의 건 `lanternFar`)
- 하늘 풍등 `setSkyWishes`: 고정 먼저 + 최근 20개, 달 둘레(az MOON_AZ+4±24, el 12~38), 크기 3.4×4.2 + 빛 스프라이트. 누르면 `WishView`(이루어지길 → `flareWish` 로 환해짐, 다음 소원 →, 모두 보기 → `WishList`)
- 이름표는 가운데 이야기 카드(`getCardRect`)와 겹치면 숨음(0.25초마다 투영 검사)
- 데이터 `lib/wishes.ts`: `listSky`(24시간 `WISH_SKY_HOURS` 또는 `pinned`, memo 15초 `wishes:sky`), 하루 3번은 `kst_day` 기준, `WISH_PER_IP_DAY` 12, 신고 3곳 숨김, 위기 낱말 private. 관리자 `/api/admin/wish` list|hide|unhide|pin|unpin|remove. 사용자 소원 3개(id 23·24·36)는 고정, 절대 삭제 금지

## 유령 클릭 (폰에서 창이 바로 닫히던 원인)
- 캔버스 터치 뒤 브라우저가 만드는 click 이 방금 열린 창 배경에 떨어져 닫힘. `HillScene` 이 `touchend` 에 preventDefault, `BottomSheet` 는 연 뒤 400ms 배경 무시. 헤드리스에선 `touchscreen.tap` 으로만 재현됨(`mouse.click` 은 안 됨)

## 주제 판
- 제목·점 버튼 → `topicOpen` BottomSheet. `slots`(ZODIAC × assignRooms) 2열, 칸 = `goTo(i)`, 연필 = `/room/{slug}/write`, 빈 칸 = `/propose`. 이야기 수 `SkyRoom.count`
- 첫 화면 아래 `RoomList` 제거, `#rooms` 엔 h1 + 방 이름 글자 링크(검색 엔진·WebGL 없는 기기)

## 글 쓴 뒤 내 별
- `WriteForm` 완료 화면 첫 버튼 "하늘에서 내 별 보기" → `/?born=ID&room=slug`. `Hill` 은 lazy useState 로 쿼리 읽고 sky 로드 뒤 `celebrateStar(id)`(aBorn=now 로 태어나는 움직임 + `highlightById`) 실패하면 별자리로만 `goTo`. 토스트 `hill_my_star_born`, 소리 `born`, 주소에서 쿼리 제거

## 첫 안내·힌트
- 안내 5장(`INTRO_N`, 4장째 부두). 안내 뒤 "끌어서 하늘을 돌려 보세요"(`star_drag_seen`, 끌거나 14초면 끝, 장면 `onLookDrag`)

## 공유 이미지
- 배경 `public/og/hill.jpg` 는 `scripts/capture-og-bg.mjs`(하늘 풍등 숨기고 찍음). 이야기 이미지엔 주제 옆 별자리 이름(`assignRooms` + `ZODIAC[i].names[lang]`, 기호는 글꼴에 없어 뺌)
