# code-tactics-lp

[code-tactics](https://github.com/keroway/code-tactics) の紹介ページ (ランディングページ / LP)。

ゲーム本体ではなく、**ゲームを紹介してプレイ画面へ誘導する** ための静的サイト。

## code-tactics とは

2D プログラマブル・オートバトルゲーム。プレイヤーはユニットを直接操作せず、戦闘前に
AI ルール (ガンビット式) を設定し、自動戦闘の結果とログを観察・改善するサイクルが中核。

> 「自分で組んだ AI で戦車を戦わせ、負けた理由をログで分析し、ルールを直して再挑戦する」

- ゲーム本体リポジトリ: <https://github.com/keroway/code-tactics>
- プレイ (web 版): <https://keroway.github.io/code-tactics/>

## この LP の役割

- ゲームのコンセプトと魅力を 1 ページで伝える
- スクリーンショット / 短いデモでゲーム性を見せる
- 「今すぐプレイ」「GitHub を見る」への導線
- (将来) 更新情報・ロードマップへのリンク

## Status

🚧 **準備中** — 技術スタック選定後にサイトを実装する。現状はドキュメントのみ。

## 技術スタック (推奨)

LP は「速くて軽い静的サイト」が最適。**Astro を推奨**。詳細・代替案・選定理由は
[docs/tech-stack.md](./docs/tech-stack.md) を参照。

| 区分 | 推奨 | 補足 |
| --- | --- | --- |
| フレームワーク | **Astro** | コンテンツ中心の静的サイトに最適。JS をほぼ吐かず高速 |
| スタイリング | Tailwind CSS | LP の見た目を素早く作れる |
| ホスティング | GitHub Pages または Vercel | 本体 web 版が GitHub Pages 配信なので揃えやすい |

> 別途検討の余地あり。本体 (Svelte 5 + Vite) と技術を揃えたい場合は SvelteKit も有力。

## Getting started

技術スタック確定後にこのセクションを更新する。Astro を採用する場合のイメージ:

```sh
# プロジェクト初期化 (確定後に実行)
npm create astro@latest

# 開発サーバー
npm run dev

# 本番ビルド (静的出力)
npm run build
```

## Documents

- [docs/tech-stack.md](./docs/tech-stack.md) — 技術スタックの推奨と選定理由
- [docs/content-plan.md](./docs/content-plan.md) — LP に載せるコンテンツの構成案

## License

[MIT License](./LICENSE)。
