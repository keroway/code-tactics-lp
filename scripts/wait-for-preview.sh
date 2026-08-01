#!/usr/bin/env bash
# Astro preview が GitHub Pages と同じサブパスで応答するまで待機する。
# CI のブラウザ検証・リンク検証で共用する。
set -euo pipefail

url="${BASE_URL:-http://localhost:4321/code-tactics-lp/}"
log_file="${PREVIEW_LOG:-preview.log}"

for _ in $(seq 1 30); do
  if curl -sf "$url" >/dev/null; then
    echo "preview server is up: $url"
    exit 0
  fi
  sleep 1
done

echo "preview server did not start in time: $url" >&2
cat "$log_file" >&2 || true
exit 1
