# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリの性質

ゲーム本体ではなく、2D プログラマブル・オートバトルゲーム
[code-tactics](https://github.com/keroway/code-tactics) の **紹介ページ (LP)**。
1 ページ完結のマーケティングサイトで、コンセプトを伝えてプレイ画面 (web 版) と
GitHub へ誘導するのが目的。ログインやリッチな双方向 UI は不要な静的サイト。

正典コピー (ゲーム概要・コンセプト・ロードマップ) は本体の
[SPEC.md](https://github.com/keroway/code-tactics/blob/main/SPEC.md) 由来。
LP の文言はそこから引いて短く言い換える方針 (`docs/content-plan.md`)。

## 現状とスタック

**実装済み・公開中** (<https://keroway.github.io/code-tactics-lp/>)。Astro でビルドし
GitHub Pages へ自動デプロイ。デザイン基盤 (配色/タイポグラフィ・SEO/OGP・アクセシビリティ・
スクロール演出・回遊ナビ・モバイルナビ・404 ページ) と主要セクション
(Hero / Concept / HowToPlay / Features / HowItWorks / Roadmap / FAQ) は実装済み。
CI で Lighthouse 計測とリンク切れ検出も走らせている。残る主作業はゲーム画面のスクショ/GIF など
**実アセットの差し込み** (#6) とコピーの磨き込み。

確定済みスタック (`docs/decisions.md` が決定記録):

- フレームワーク: **Astro** (v6)
- スタイリング: **Tailwind CSS** (v4 / `@tailwindcss/vite` プラグイン経由。
  グローバル CSS は `src/styles/global.css` の `@import "tailwindcss";` のみ。
  v3 系の `tailwind.config` や `@astrojs/tailwind` 統合は使わない)
- ホスティング: **GitHub Pages** (`.github/workflows/deploy.yml` が `withastro/action@v5`
  で main push 時にデプロイ。Pages のソースは「GitHub Actions」)

```sh
npm run dev          # 開発サーバー (/code-tactics-lp/ 配下で配信)
npm run build        # 静的出力 → dist/
npm run preview      # ビルド結果のプレビュー
npm run astro check  # 型チェック
```

## デプロイ

main にマージすると GitHub Actions が自動でビルド・デプロイする。手動実行は Actions の
"Deploy to GitHub Pages" ワークフローの `workflow_dispatch` から。

## 主要ファイル

- `astro.config.mjs` — `site` / `base` (`/code-tactics-lp`) と Tailwind の Vite プラグイン
- `src/layouts/Layout.astro` — `<head>` / meta / OGP。アセットは `import.meta.env.BASE_URL` 前置
- `src/pages/index.astro` — LP 本体 (1 ページ)。セクション構成は `docs/content-plan.md` に対応

## 実装時の重要な制約

- **GitHub Pages のサブパス配信**: 本体 web 版が `keroway.github.io/code-tactics/`
  というサブパスで配信されているのと同様、この LP も GitHub Pages 上ではサブパスに
  なる可能性が高い。Astro の `base` (および `site`) 設定を正しく行わないと、
  内部リンク・アセットパスが壊れる。scaffold 時に最初に確認すること。

## ドキュメント

- `docs/decisions.md` — 技術選定の決定記録 (ADR 風)。確定事項の根拠
- `docs/tech-stack.md` — スタック選定理由と代替案比較の資料
- `docs/content-plan.md` — LP に載せるセクション構成・必要アセット
- `docs/design-direction.md` — デザイン検討のたたき台 (トーン/配色/タイポ/a11y)
