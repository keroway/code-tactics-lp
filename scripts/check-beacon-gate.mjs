import { readFile } from "node:fs/promises";
import { walkHtml } from "./lib/walk-html.mjs";

/**
 * Cloudflare Web Analytics ビーコンの出力欠落をビルド成果物で検証する。
 *
 * ## なぜ必要か（#205）
 *
 * `src/layouts/Layout.astro` のビーコン出力は
 * `import.meta.env.PROD && cfBeaconToken` でのみ発火し、`PUBLIC_CF_BEACON_TOKEN`
 * が空・未設定・キー名変更などで欠落してもビルドは正常終了し、`<script>` タグが
 * 黙って出力されないだけになる。CI (`ci.yml`) はこのトークンを意図的に渡さない
 * ため、検査対象は本番ビルドを行う `deploy.yml` に限る。
 */

const DIST_DIR = "dist";
const BEACON_TAG_PATTERN = /static\.cloudflareinsights\.com\/beacon\.min\.js/;

// deploy.yml の build job のみがこのトークンを持つ。未設定のまま実行された
// 場合（例: workflow_dispatch を手元で試すなど）はビーコンが出ないのが正しい
// 挙動なので、このゲートは何もチェックせずに成功させる。
const beaconTokenExpected = Boolean(process.env.PUBLIC_CF_BEACON_TOKEN);

if (!beaconTokenExpected) {
  console.log(
    "check-beacon-gate: SKIP (PUBLIC_CF_BEACON_TOKEN 未設定。ビーコン非出力が正しい挙動)"
  );
  process.exit(0);
}

const misses = [];
let htmlCount = 0;

for await (const file of walkHtml(DIST_DIR)) {
  htmlCount++;
  const html = await readFile(file, "utf8");
  if (!BEACON_TAG_PATTERN.test(html)) misses.push(file);
}

// 走査対象が 0 件だと、判定が素通りしてしまう。
// 「ビルドし忘れ」を成功と読み違えないための前提チェック。
if (htmlCount === 0) {
  console.error(
    `${DIST_DIR}/ に HTML がありません。先に \`pnpm run build\` を実行してください。`
  );
  process.exit(1);
}

if (misses.length > 0) {
  console.error(
    "PUBLIC_CF_BEACON_TOKEN が設定されているにもかかわらず、Cloudflare Web Analytics のビーコンタグが出力されていないページがあります。"
  );
  console.error(
    "secret の値が空文字列にリセットされていないか、Layout.astro の分岐が壊れていないか確認してください。"
  );
  for (const file of misses) console.error(`  ${file}`);
  process.exit(1);
}

console.log(
  `check-beacon-gate: OK (Cloudflare Web Analytics ビーコンが ${htmlCount} 件全ページで出力されています)`
);
