# keroway 標準 justfile（package.json scripts への薄い委譲のみ）

default:
    @just --list

build:
    pnpm run build

# ユニットテスト(CI ゲートスクリプト)に加え、build + `pnpm run preview` 起動後に a11y スモークを実行する
test:
    #!/usr/bin/env bash
    set -euo pipefail
    pnpm run test
    pnpm run build
    pnpm run preview > preview.log 2>&1 &
    preview_pid=$!
    trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
    bash scripts/wait-for-preview.sh
    pnpm run smoke:a11y

lint:
    pnpm run lint

format:
    pnpm run format

# lint / format:check / astro check をまとめて実行（コミット前の全通し確認）
check:
    pnpm run check
