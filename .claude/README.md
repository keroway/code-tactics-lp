# code-tactics-lp — Claude Code Setup

このディレクトリは Claude Code の動作をこのプロジェクト用に整える共有設定です。
`CLAUDE.md`（リポジトリルート）と一緒に読んでください。

## 構成

```text
.claude/
├── hooks/
│   └── post-stop-check.sh   # Stop: 変更があれば biome ci (lint) + astro check を実行
├── settings.json             # 共有設定（hook 登録、コミット対象）
└── worktrees/                 # git worktree 置き場（.gitignore で除外、横断作業の対象外）
```

## 依存ツール

| ツール | 用途                   | 必須？                                                         |
| ------ | ---------------------- | -------------------------------------------------------------- |
| `pnpm` | lint・typecheck の実行 | 必須（hook が PATH を要求、無いと Stop hook が exit 2 で通知） |
| `jq`   | hook 内 JSON 抽出      | 無い環境では非依存フォールバックで動作                         |

## Hooks の挙動

### Stop: `post-stop-check.sh`

- 発火条件: Claude が応答を終えたとき（変更ファイルが無ければ即終了）
- 動作: 変更ファイル（uncommitted + untracked + 未 push commit）を分類し、
  `src/**` や `astro.config.mjs` / `tsconfig.json` / `biome.json` / `package.json` に
  変更があれば `pnpm run lint`（biome ci）+ `pnpm exec astro check` を実行
- 失敗時: exit 2 で Claude にフィードバック（ブロッキング）
- pnpm が見つからない等「検証できない」場合も exit 2（silent-pass しない）
- 一時的に止めたい場合: `LP_SKIP_STOP_HOOK=1`
- vitest 等のユニットテストは本リポジトリに存在しないため対象外。
  format:check (prettier) は差分規模と対象拡張子の広さから hook には含めず、
  lefthook の pre-commit と CI の `pnpm run check` に委ねる

## 位置づけ

keroway/CLAUDE.md の方針「検証は安い順に段階化する」に基づき、決定的チェック
（lint / typecheck、秒オーダー）をターン終了ごとの第一防衛線にする。
codex stop review gate は本リポジトリでは無効。設計レビューが必要なときは
手動で `/code-review` を起動する。

## 他環境への移植

- hook スクリプトは `#!/usr/bin/env bash`
- 絶対パスは `$CLAUDE_PROJECT_DIR` で解決する

新しい開発者がリポジトリをクローンした場合、追加でやることはありません。
Claude Code が `settings.json` を読み込めば hook が有効になります。
