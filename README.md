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

🌐 **公開中** — Astro + Tailwind CSS で実装し、GitHub Pages へ自動デプロイ済み。

- ライブ: <https://keroway.github.io/code-tactics-lp/>
- main への push で GitHub Actions が自動ビルド・デプロイする

中身はまだ初期スケルトン。デザインの作り込み・スクリーンショット/デモ・コピーの磨き込みが今後の作業。

## 技術スタック (決定)

LP は「速くて軽い静的サイト」が最適。下記で確定。決定の根拠は
[docs/decisions.md](./docs/decisions.md)、選定理由と代替案比較は
[docs/tech-stack.md](./docs/tech-stack.md) を参照。

| 区分           | 採用             | 補足                                                                          |
| -------------- | ---------------- | ----------------------------------------------------------------------------- |
| フレームワーク | **Astro**        | コンテンツ中心の静的サイトに最適。JS をほぼ吐かず高速                         |
| スタイリング   | **Tailwind CSS** | LP の見た目を素早く作れる                                                     |
| ホスティング   | **GitHub Pages** | 本体 web 版が GitHub Pages 配信なので運用を揃えやすい (`base` パス設定に注意) |

## Getting started

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

## Documents

- [docs/decisions.md](./docs/decisions.md) — 技術選定の決定記録 (確定事項と根拠)
- [docs/tech-stack.md](./docs/tech-stack.md) — 技術スタックの選定理由と代替案比較
- [docs/content-plan.md](./docs/content-plan.md) — LP に載せるコンテンツの構成案
- [docs/design-direction.md](./docs/design-direction.md) — デザイン検討のたたき台

## License

[MIT License](./LICENSE)。
