# 技術選定の決定記録

> ステータス: **決定済み**。検討の経緯・代替案の詳細な比較は
> [tech-stack.md](./tech-stack.md) を参照。本ファイルは「何を・なぜ決めたか」を
> 簡潔に固定するための記録 (ADR 風)。

## 決定 1: フレームワーク = Astro

静的コンテンツ主体の LP に最適化されており、デフォルトでクライアント JS をほぼ
出力しない → 表示が速く SEO / Core Web Vitals に有利。Markdown / MDX で文章主体の
ページを書けて相性が良く、必要箇所だけ「島 (Islands)」として React/Svelte 等を
埋め込めるため、将来インタラクティブなデモを足す拡張余地も残る。

**却下した代替案**:

- **SvelteKit** — 本体 (Svelte 5 + Vite) とスタック統一できる次点候補だが、LP には
  機能過多で静的化に追加設定が要る。
- **Next.js** — エコシステムは巨大だが LP には重く、デフォルトで JS を多く吐く。
- **素の HTML/CSS + Vite** — 依存は最小だが、コンポーネント化・コンテンツ管理が手作業に。

## 決定 2: スタイリング = Tailwind CSS

LP の見た目をユーティリティクラスで素早く組める。Astro と公式に統合でき、未使用
クラスは自動で削られるため出力 CSS も軽い。

## 決定 3: ホスティング = GitHub Pages

本体 web 版が `keroway.github.io/code-tactics/` で GitHub Pages 配信されており、
運用を揃えやすい。

- **注意**: サブパス配信になるため Astro の `base` / `site` 設定が必須
  (詳細は [../CLAUDE.md](../CLAUDE.md) の「実装時の重要な制約」)。
- **却下した代替案**: Vercel — プレビューデプロイや独自ドメインは簡単だが、今回は
  本体との運用統一を優先。別ドメイン/サブドメインで出したくなった時の再検討候補。

## 決定 4: アクセス解析 = Cloudflare Web Analytics

### 採用理由

「無料・クッキーレス・GitHub Pages 対応」の 3 条件をすべて満たす。

- **完全無料**: Cloudflare アカウント (free tier) さえあれば追加費用なし。
- **クッキーレス・GDPR 準拠**: Cookie / localStorage を使わない。
  GDPR・CCPA のコンプライアンス上も Cookie バナー不要。
- **GitHub Pages で動作**: DNS 変更・Cloudflare Proxy 移行は不要。
  Cloudflare ダッシュボードで "JavaScript Snippet" 方式を選択し、
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "..."}'>` を `src/layouts/Layout.astro` の
  `<head>` 末尾に追加するだけで計測開始できる。
- **Lighthouse への影響が軽微**: `beacon.min.js` は圧縮後 約 4.3 KB (非圧縮 約 10 KB)、
  `defer` 属性付きで非ブロッキング読み込み。Astro + Cloudflare Web Analytics の
  組み合わせで Lighthouse 全カテゴリ 100 点を達成した事例も報告されている。
  現行の CI ゲート (performance / accessibility / best-practices / seo それぞれ
  minScore: 0.9) に対して影響は軽微と評価する。

  ただし **known issue** として、`beacon.min.js` の Cache-Control ヘッダーが
  Cloudflare 側で制御されているため、Lighthouse の
  "Serve static assets with an efficient cache policy" 監査に引っかかる場合がある。
  これは `best-practices` ではなく `performance` カテゴリの警告（スコア減少量は
  通常 1〜3 pt 程度）であり、現行ゲート (0.9) を割る可能性は低い。
  万一スコアが低下した場合は CI ゲートの該当項目を `warn` に格下げするか、
  Cloudflare Zaraz（サーバーサイド注入でクライアント JS ゼロ）への移行を検討する。

### 外部アカウント・ドメイン設定の手順（概要）

1. [cloudflare.com](https://cloudflare.com) で **無料アカウントを作成**する。
2. ダッシュボード左メニュー > **Web Analytics** > **Add a site** を開く。
3. ホスト名に `keroway.github.io` を入力し、**JavaScript Snippet** 方式を選択する
   （DNS 変更・Proxy 設定は不要）。
4. 発行された `<script>` タグを `src/layouts/Layout.astro` の `<head>` 内に追加する。
5. 数分後にダッシュボードにページビューが表示されることを確認する。

DNS 変更・Cloudflare へのドメイン移管は一切不要。GitHub Pages の設定変更も不要。

### 却下した代替案

- **Plausible Analytics** — スクリプトが 1 KB 未満・GDPR 準拠・クッキーレスと
  技術面では最優秀。ただし **クラウド版は有料のみ**（最安 $9/月）。
  セルフホスト版は無料だが、別途サーバー運用コストが発生するため今回の
  「追加インフラなし」要件に合わない。将来有料プランを検討する際の第一候補。
- **Google Analytics 4** — 無料だが Cookie を使用し Cookie バナーが必要。
  スクリプトが 45 KB 超と重く Lighthouse スコアを大きく下げる可能性がある。
  LP のシンプルな運用方針とも相容れないため除外。
