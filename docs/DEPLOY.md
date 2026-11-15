# 배포 (star.binaryworld.kr) — 다른 프로젝트와 같은 방식: git push → Jenkins → docker compose

## 구성 (준비된 것)
- `Dockerfile` : 포트 3100, `tsx server.ts`. 시작 때 `prisma migrate deploy` + 방 보장 시드
- `/home/binary/binaryworld/infra/docker-compose.yml` : `star` 서비스(컨테이너 `star-app`, DB `mysql-local:3306/star`) 추가됨
- `deploy/Caddyfile.star` : Caddy 에 붙일 조각 (`star:3100`, 웹소켓은 자동 업그레이드)
- Jenkins 잡 `binaryworld-star` : 사용자가 웹에서 wedding 잡 복제해 만듦(빌드 인자 없음 → 카카오·애드센스 공개 키는 Dockerfile ARG 기본값에 둠). `deploy/jenkins/config.xml` 은 참고용
- 원격: `git@github.com:ljs14741/binary_star.git`, 브랜치 `master`

## 처음 한 번 사람이 할 것 (루트 권한·외부 계정 필요)
1. GitHub 에 `ljs14741/binary_star` 저장소 생성 (비어 있게) → `git push -u origin master`
2. 저장소 Settings → Webhooks → `binary_wedding` 저장소와 같은 URL(Jenkins `/github-webhook/`) 로 push 웹훅 추가
3. DNS: `star.binaryworld.kr` A 레코드 → `game.binaryworld.kr` 과 같은 IP
4. Caddy
   ```bash
   sudo sh -c 'cat /home/binary/workspace/binary_star/deploy/Caddyfile.star >> /home/binary/binaryworld/caddy/Caddyfile'
   sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```
5. Jenkins 잡
   ```bash
   sudo mkdir -p /home/binary/binaryworld/jenkins/jobs/binaryworld-star
   sudo cp /home/binary/workspace/binary_star/deploy/jenkins/config.xml /home/binary/binaryworld/jenkins/jobs/binaryworld-star/config.xml
   ```
   → Jenkins(http://192.168.219.150:7000) 관리 → "설정 다시 읽어오기(Reload Configuration from Disk)" → `binaryworld-star` 잡 "지금 빌드"
6. (선택) `sudo usermod -aG docker binary` 하면 다음부터 Claude 가 Caddy 리로드·컨테이너 확인을 직접 함

## 그 다음부터
- 코드 수정 → `git push` → Jenkins 자동 빌드·재시작
- 확인: `sudo docker logs -f star-app`, https://star.binaryworld.kr
- 카카오 공유: 카카오 개발자 콘솔 플랫폼(Web)에 `https://star.binaryworld.kr` 등록
- 정식 오픈 전: `npm run db:clear-seed`(테스트 글 삭제), `ANTHROPIC_API_KEY` 를 compose 에 넣으면 AI 검수·번역 켜짐
- 관리자 페이지: `https://star.binaryworld.kr/ko/admin?key=<STAR_ADMIN_KEY>` (키는 compose 환경변수 `STAR_ADMIN_KEY`, 로컬은 `.env.local`). 키 없으면 404. 방문자·글·공감·방별·최근 글 숨기기/내리기·신고·제안

## 클라우드플레어 (2026-11-15 전환)
- binaryworld.kr 네임서버 → 클라우드플레어(peter/zita.ns.cloudflare.com). 무료 플랜, 모든 서브도메인 프록시(주황 구름). SSL 모드 Full (strict). 되돌리기는 가비아에서 네임서버를 ns.gabia.co.kr / ns1.gabia.co.kr / ns.gabia.net 로
- Caddyfile 전역 블록에 `trusted_proxies`(클라우드플레어 대역) + `client_ip_headers` → 앱이 보는 X-Forwarded-For 첫 값이 진짜 방문자 IP. 이게 없으면 Caddy 가 헤더를 버려서 모든 방문자가 클라우드플레어 IP(홍콩 등)로 보임 → 지역·공감 제한이 전부 섞임
- 정적 파일(`/_next/static`)은 클라우드플레어 캐시(cf-cache-status HIT), HTML·API 는 DYNAMIC. 웹소켓(/ws) 무료 플랜에서 됨
- 컨테이너 `star-app` 은 compose 에 `mem_limit: 1536m`
- 확인(이 PC 에선 공인 IP 헤어핀이 안 되니 클라우드플레어 IP 로): `ip=$(dig +short A star.binaryworld.kr @peter.ns.cloudflare.com | head -1); curl -s --resolve star.binaryworld.kr:443:$ip https://star.binaryworld.kr/cdn-cgi/trace`
