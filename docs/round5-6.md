# 5·6차 (2026-11-14) — 배포 + 폰 피드백 반영. 자세한 건 git log 로

## 배포 (DEPLOY.md 참고)
- git init → GitHub `ljs14741/binary_star`(사용자 생성) → 웹훅·Jenkins 잡(사용자가 웹에서 wedding 잡 복제) → compose `star` 서비스(Claude) → Caddy `star.binaryworld.kr`(사용자 sudo) → DNS 가비아(사용자)
- 첫 빌드 실패 원인: 빈 `public/` 이 git 에 없음 → `.gitkeep`. 카카오·애드센스 공개 키는 Dockerfile ARG 기본값(Jenkins 잡에 빌드 인자 없음)

## 5차 (커밋 1e0b158) 폰 피드백
- 끌어 걷기(섬·내 요정을 잡으면 walk 모드, 하늘은 look), 땅 누르기가 별·별자리보다 우선, 조작 뒤 20초 자동 넘김 정지
- 별자리 넘김 소리·배경음 제거(효과음만). 손 흔들기(`gesture` 프로토콜 사용, 합류 시 자동). 접속 인원 숫자 항상 표시

## 6차 (커밋 c99d8e3 → 7b19238, 5단계 각각 커밋) 세로 화면 전용 레이아웃
1. 3D 안 별자리 이름표 숨김(`applyLabelVisibility`), 카드를 수평선 위로
2. `exportHorizon()` 가 매 프레임 수평선 화면 % 를 `.hill-wrap` 의 `--hill-horizon` 에 씀. 카드는 `portrait:top-[var(--hill-horizon)]` + translateY(-100%)
3. `PORTRAIT_CAM_FWD=3.2` 카메라 전진. 끌기는 잡은 지점 기준 상대 이동(`pointer.g0/me0`)
4. 위 안내 한 줄 + `HILL_CAP`(150) 표시(`hill_online` 에 {cap})
5. 아래 '주제 방' 안내 `hidden landscape:flex`

## 못 한 것 / 열린 질문
- "은영" 이름: 어디에도 없음. 사용자에게 어디서 봤는지 확인
- 사용자가 아직 6차 실물 확인 전
