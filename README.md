# code-tactics-lp

[code-tactics](https://github.com/keroway/code-tactics) の紹介ページ (ランディングページ / LP)。

ゲーム本体ではなく、**ゲームを紹介してプレイ画面へ誘導する** ための静的サイト。

## code-tactics とは

2D プログラマブル・オートバトルゲーム。プレイヤーはユニットを直接操作せず、戦闘前に
AI ルール (ガンビット式 / 簡易プログラム) を設定し、自動戦闘の結果とログを観察・改善するサイクルが中核。

> 「自分で組んだ AI で部隊を戦わせ、負けた理由をログとリプレイで分析し、ルールを直して再挑戦する」

- ゲーム本体リポジトリ: <https://github.com/keroway/code-tactics>
- プレイ (web 版): <https://keroway.github.io/code-tactics/>

## この LP の役割

- ゲームのコンセプトと魅力を 1 ページで伝える
- スクリーンショット / 短いデモでゲーム性を見せる
- 「今すぐプレイ」「GitHub を見る」への導線
- (将来) 更新情報・ロードマップへのリンク

## Status

🌐 **公開中** — Astro + Tailwind CSS で実装し、GitHub Pages へ自動デプロイ済み。

- ライブ: <https://keroway.github.io/code-tactics-lp/>
- main への push で GitHub Actions が自動ビルド・デプロイする

デザイン基盤 (配色/タイポグラフィ・SEO/OGP・アクセシビリティ・スクロール演出・回遊ナビ・
モバイルナビ・FAQ・404 ページ) は実装済み。CI で Lighthouse 計測とリンク切れ検出も継続している。
本体の進捗 (複数ユニット、障害物、簡易プログラム言語、キャンペーン、非同期対戦など) に合わせて
LP コピーを更新済み。残る主作業は最新の実ゲーム画面スクリーンショット/デモ GIF の差し替えとコピーの磨き込み。

## 技術スタック (決定)

LP は「速くて軽い静的サイト」が最適。下記で確定。決定の根拠は
[docs/decisions.md](./docs/decisions.md)、選定理由と代替案比較は
[docs/tech-stack.md](./docs/tech-stack.md) を参照。

| 区分           | 採用             | 補足                                                  |
| -------------- | ---------------- | ----------------------------------------------------- |
| フレームワーク | **Astro**        | コンテンツ中心の静的サイトに最適。JS をほぼ吐かず高速 |
| スタイリング   | **Tailwind CSS** | LP の見た目を素早く作れる                             |
| ホスティング   | **GitHub Pages** | 本体 web 版と運用を揃えやすい (`base` パス設定に注意) |

## Getting started

> **必要環境**: Node.js 22 (CI も `node-version: 22` で動かしている)。`nvm use` などで合わせる。

```sh
# 依存インストール
npm install

# 開発サーバー (http://localhost:4321/code-tactics-lp/)
npm run dev

# 本番ビルド (静的出力 → dist/)
npm run build

# ビルド結果のローカルプレビュー
npm run preview

# 型チェック
npm run astro check

# Lint (ESLint + eslint-plugin-astro)
npm run lint

# 整形 (Prettier + prettier-plugin-astro)
npm run format        # 上書き整形
npm run format:check  # 差分チェックのみ
```

> GitHub Pages のサブパス配信に合わせ `astro.config.mjs` で `base: /code-tactics-lp` を
> 設定済み。開発サーバーも `/code-tactics-lp/` 配下で配信される。

### 生成アセットの再生成

`public/og.png` と `public/apple-touch-icon.png` はリポジトリにコミットされているが、
実体は `scripts/generate-og.mjs` / `scripts/generate-icons.mjs` の生成物。配色やコピー、
SVG テンプレートを変更したときは必ず再生成してコミットする。

```sh
npm run og      # public/og.png (1200x630) を再生成
npm run icons   # public/apple-touch-icon.png (180x180) を再生成
```

CI (`.github/workflows/ci.yml` の `assets` ジョブ) で同じコマンドを実行し
`git diff --exit-code -- public/` で差分が無いか検証する。再生成漏れがあれば
PR の CI が落ちるので、ローカルで上記コマンドを流し直してコミットすれば解消する。

## Deploy

`main` への push で GitHub Actions の `Deploy to GitHub Pages`
(`.github/workflows/deploy.yml`) が自動でビルド・デプロイする。

手動で再デプロイしたい場合は GitHub の Actions タブから
`Deploy to GitHub Pages` ワークフローを開き、`Run workflow` (`workflow_dispatch`)
で `main` を選んで実行する。CLI からは:

```sh
gh workflow run "Deploy to GitHub Pages" --ref main
```

## Documents

- [docs/decisions.md](./docs/decisions.md) — 技術選定の決定記録 (確定事項と根拠)
- [docs/tech-stack.md](./docs/tech-stack.md) — 技術スタックの選定理由と代替案比較
- [docs/content-plan.md](./docs/content-plan.md) — LP に載せるコンテンツの構成案
- [docs/design-direction.md](./docs/design-direction.md) — デザイン検討のたたき台

## License

[MIT License](./LICENSE)。
