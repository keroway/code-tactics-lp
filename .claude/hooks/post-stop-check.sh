#!/usr/bin/env bash
# Stop hook: Claude の応答完了時に、変更があれば biome ci + astro check を実行する。
#
# 位置づけ:
#   keroway/CLAUDE.md の方針どおり、決定的チェック（fmt / lint / typecheck）を
#   ターン終了ごとの第一防衛線にする。lefthook の pre-commit は staged ファイルにしか
#   効かないため、未コミットのままターンが終わるケースをここで拾う。
#   本リポジトリには vitest 等のユニットテストは存在しないため対象外。
#
# 動作:
#   1. 変更ファイル（uncommitted + untracked + 未 push の commit）を分類する
#   2. コード/コンテンツが変わったら pnpm run lint (biome ci) + astro check を実行
#   3. 失敗時は stderr に内容を出力し exit 2 で Claude にフィードバックする
#   4. pnpm が見つからないのに対象変更がある場合も FAIL として通知する
#      （silent-pass しない = 「検証できない」を「成功」と扱わない）
#
# 実行するコマンドは `pnpm run check`（= just check）の lint / astro check 部分と
# 一致させる。format:check (prettier) は差分が小さければ数秒で終わるが、対象拡張子が
# 広く重複が多いため、ここでは lint + astro check に絞る
# （format 崩れは lefthook pre-commit と CI の format:check で最終的に拾われる）。
#
# 無限ループ防止:
#   stop_hook_active=true の場合（hook 由来の再起動）はスキップ
#
# スキップしたい場合:
#   LP_SKIP_STOP_HOOK=1 を設定する

set -u

INPUT="$(cat || true)"

if command -v jq >/dev/null 2>&1; then
  STOP_HOOK_ACTIVE="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
else
  # jq 非依存フォールバック: 空白を除いた生 JSON を直接照合する
  # （jq が無い環境ではここで "false" 固定にすると下の無限ループ防止が丸ごと無効になる）。
  COMPACT_INPUT="$(printf '%s' "$INPUT" | tr -d ' \t\n\r')"
  case "$COMPACT_INPUT" in
    *'"stop_hook_active":true'*) STOP_HOOK_ACTIVE="true" ;;
    *) STOP_HOOK_ACTIVE="false" ;;
  esac
fi

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

if [ "${LP_SKIP_STOP_HOOK:-}" = "1" ]; then
  exit 0
fi

# silent-pass 禁止: cd / git 確認に失敗したら exit 2 で Claude に通知する。
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
if ! cd "$PROJECT_DIR" 2>/dev/null; then
  {
    echo "Stop hook: PROJECT_DIR ($PROJECT_DIR) に cd できません。検証をスキップしました。"
    echo "  CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-(unset)}"
    echo "hook の設定 (.claude/settings.json) と作業ディレクトリを確認してください。"
  } >&2
  exit 2
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  {
    echo "Stop hook: $(pwd) は git リポジトリではありません。変更ファイルを判定できないため検証をスキップしました。"
    echo "（一時的に止めたい場合は環境変数 LP_SKIP_STOP_HOOK=1）"
  } >&2
  exit 2
fi

# 変更ファイル一覧（unstaged + staged + untracked + 未 push の commit）。
# 未 push 範囲の決め方は上流ブランチ → origin/main → 空、の順に degrade する。
# push 前の新規ブランチでは @{u} が無いため、origin/main からの分岐点を使う
# （直近 N commit を見る fallback は、そのターンで触っていない main の変更まで
#   拾ってしまい、毎ターン全ステップが走る原因になる）。
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [ -n "$UPSTREAM" ]; then
  UNPUSHED_RANGE="${UPSTREAM}..HEAD"
elif git rev-parse --verify origin/main >/dev/null 2>&1; then
  UNPUSHED_RANGE="origin/main..HEAD"
else
  UNPUSHED_RANGE=""
fi

CHANGED_FILES="$(
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
    if [ -n "$UNPUSHED_RANGE" ]; then
      git log --name-only --pretty=format: "$UNPUSHED_RANGE" 2>/dev/null || true
    fi
  } | sed '/^$/d' | sort -u
)"

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

CODE_CHANGED=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # lint (biome ci) / astro check の対象: src 配下と主要設定ファイル
  # .claude/ 配下（本 hook 自体を含む）は対象外
  if [[ "$file" == src/* ]] \
    || [[ "$file" == "astro.config.mjs" ]] \
    || [[ "$file" == "tsconfig.json" ]] \
    || [[ "$file" == "biome.json" ]] \
    || [[ "$file" == "package.json" ]]; then
    CODE_CHANGED=1
  fi
done <<< "$CHANGED_FILES"

if [ "$CODE_CHANGED" -eq 0 ]; then
  exit 0
fi

FAILED=0
REPORT=""

append_report() {
  REPORT="${REPORT}$1"$'\n'
}

# 関数内で FAILED / REPORT を書き換えるためサブシェルは作らない。
run_step() {
  local label="$1"
  shift
  echo "→ [stop-hook] $label" >&2

  local output
  local rc=0
  output="$("$@" 2>&1)" || rc=$?

  if [ "$rc" -ne 0 ]; then
    FAILED=1
    append_report ""
    append_report "❌ $label が失敗しました (rc=$rc)"
    append_report "コマンド: $*"
    append_report "$output"
  fi
}

if ! command -v pnpm >/dev/null 2>&1; then
  {
    echo "Stop hook: pnpm が見つかりません。変更があるのに lint / typecheck を検証できませんでした。"
    echo "  PATH=$PATH"
  } >&2
  exit 2
fi

run_step "biome ci (lint)" pnpm run --silent lint
run_step "astro check (typecheck)" pnpm exec astro check

if [ "$FAILED" -eq 1 ]; then
  {
    echo "Stop hook: lint / typecheck に失敗があります。下記を修正してから完了してください。"
    echo "（再実行をスキップしたい場合は環境変数 LP_SKIP_STOP_HOOK=1）"
    echo "$REPORT"
  } >&2
  exit 2
fi

exit 0
