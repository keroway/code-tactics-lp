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

**実装前段階**。`package.json` もビルド構成もまだ存在せず、コンテンツは `docs/` の
検討ドキュメントのみ。次の作業は選定フレームワークでの scaffold。

確定済みスタック (`docs/decisions.md` が決定記録):

- フレームワーク: **Astro**
- スタイリング: **Tailwind CSS**
- ホスティング: **GitHub Pages**

scaffold 後に有効化される想定のコマンド (現時点では未存在):

```sh
npm run dev     # 開発サーバー
npm run build   # 静的出力 (本番ビルド)
```

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
