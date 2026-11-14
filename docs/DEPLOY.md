# 배포 (star.binaryworld.kr) — 다른 프로젝트와 같은 방식: git push → Jenkins → docker compose

## 구성 (준비된 것)
- `Dockerfile` : 포트 3100, `tsx server.ts`. 시작 때 `prisma migrate deploy` + 방 보장 시드
- `/home/binary/binaryworld/infra/docker-compose.yml` : `star` 서비스(컨테이너 `star-app`, DB `mysql-local:3306/star`) 추가됨
- `deploy/Caddyfile.star` : Caddy 에 붙일 조각 (`star:3100`, 웹소켓은 자동 업그레이드)
- `deploy/jenkins/config.xml` : Jenkins 잡 `binaryworld-star` (wedding 잡 복제 + 카카오·애드센스 빌드 인자)
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
