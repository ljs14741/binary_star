#!/usr/bin/env bash
# DB-IP Lite(도시) 월간 파일과 OG 이미지용 Noto Sans 글꼴을 받음. 둘 다 무료, 출처 표기 필요(DB-IP: CC BY 4.0)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/geo data/fonts

YM=$(date +%Y-%m)
if [ ! -s data/geo/dbip-city-lite.mmdb ]; then
  echo "[geo] DB-IP Lite $YM 받는 중"
  if ! curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-${YM}.mmdb.gz" -o data/geo/dbip.mmdb.gz; then
    # 월초엔 이번 달 파일이 아직 없을 수 있어서 지난달로 재시도
    PM=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m)
    echo "[geo] $YM 없음 → $PM 재시도"
    curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-${PM}.mmdb.gz" -o data/geo/dbip.mmdb.gz
  fi
  gunzip -f data/geo/dbip.mmdb.gz && mv data/geo/dbip.mmdb data/geo/dbip-city-lite.mmdb
  echo "[geo] 완료: $(du -h data/geo/dbip-city-lite.mmdb | cut -f1)"
else
  echo "[geo] 이미 있음"
fi

# Google Fonts 에서 정적 TTF 주소를 받아 저장 (satori 는 woff2 를 못 읽어서 TTF 필요)
fetch_font() {
  local family="$1" out="$2"
  [ -s "data/fonts/$out" ] && { echo "[font] $out 이미 있음"; return; }
  local css url
  css=$(curl -fsSL -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=${family}:wght@700&display=swap")
  url=$(echo "$css" | grep -o 'https://[^)]*\.ttf' | head -1)
  [ -z "$url" ] && { echo "[font] $family 주소 못 찾음"; return 1; }
  curl -fsSL "$url" -o "data/fonts/$out"
  echo "[font] $out $(du -h data/fonts/$out | cut -f1)"
}
fetch_font "Noto+Sans+KR" NotoSansKR-Bold.ttf
fetch_font "Noto+Sans+JP" NotoSansJP-Bold.ttf
fetch_font "Noto+Sans+TC" NotoSansTC-Bold.ttf
echo "[done]"
