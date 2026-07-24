# keroway 標準 justfile（package.json scripts への薄い委譲のみ）

default:
    @just --list

build:
    pnpm run build

# ユニットテストはなし。a11y スモークは build + `pnpm run preview` 起動後に実行する
test:
    pnpm run smoke:a11y

lint:
    pnpm run lint

format:
    pnpm run format

# lint / format:check / astro check をまとめて実行（コミット前の全通し確認）
check:
    pnpm run check
