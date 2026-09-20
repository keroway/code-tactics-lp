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
 *
 * ## BEACON_GATE_REQUIRE_TOKEN（#224）
 *
 * トークンの有無だけで SKIP を判定すると、secret がリセットされて空文字列に
 * なった事故そのものを検出できない（ビルドもゲートも「未設定として正常」と
 * 判定してしまう）。本番デプロイ（deploy.yml）ではこの変数を "true" にして、
 * `PUBLIC_CF_BEACON_TOKEN` の値とは独立に「トークンは必須」と明示する。
 * ローカルでの任意実行（workflow_dispatch を手元で試す、`ci.yml` 相当の
 * トークンなし実行など）では未設定のまま SKIP させたいので、この変数を
 * 立てない限り従来どおりトークンの有無で判定する。
 */

const DIST_DIR = "dist";
// HTML コメントを除去した後の生 HTML から <script ...> の開始タグだけを拾う。
// コメント内に URL 文字列だけが残っているケースを実タグと誤認しないための前提。
const SCRIPT_TAG_PATTERN = /<script\b[^>]*>/gi;
const BEACON_SRC_PATTERN =
  /\bsrc\s*=\s*["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js["']/i;
const CF_BEACON_ATTR_PATTERN = /\bdata-cf-beacon\s*=\s*(["'])([\s\S]*?)\1/i;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

const beaconTokenRequired = process.env.BEACON_GATE_REQUIRE_TOKEN === "true";
const beaconTokenExpected =
  beaconTokenRequired || Boolean(process.env.PUBLIC_CF_BEACON_TOKEN);

if (beaconTokenRequired && !process.env.PUBLIC_CF_BEACON_TOKEN) {
  console.error(
    "check-beacon-gate: FAIL (BEACON_GATE_REQUIRE_TOKEN=true だが PUBLIC_CF_BEACON_TOKEN が未設定・空文字列)"
  );
  console.error(
    "secret PUBLIC_CF_BEACON_TOKEN がリセットされていないか確認してください。"
  );
  process.exit(1);
}

if (!beaconTokenExpected) {
  console.log(
    "check-beacon-gate: SKIP (PUBLIC_CF_BEACON_TOKEN 未設定。ビーコン非出力が正しい挙動)"
  );
  process.exit(0);
}

const expectedToken = process.env.PUBLIC_CF_BEACON_TOKEN;

// 実際に出力された <script> 要素の src と data-cf-beacon の token を検査する。
// HTML 全体に URL 文字列があるかだけを見ると、コメント内の URL や
// token 欠落・不一致の script も「出力されている」と誤判定してしまう(#227)。
function findBeaconIssue(html) {
  const withoutComments = html.replace(HTML_COMMENT_PATTERN, "");
  const scriptTags = withoutComments.match(SCRIPT_TAG_PATTERN) ?? [];
  const beaconTag = scriptTags.find((tag) => BEACON_SRC_PATTERN.test(tag));

  if (!beaconTag) return "missing script";

  const attrMatch = beaconTag.match(CF_BEACON_ATTR_PATTERN);
  if (!attrMatch) return "data-cf-beacon 属性が無い";

  let parsed;
  try {
    parsed = JSON.parse(attrMatch[2]);
  } catch {
    return "data-cf-beacon の JSON が不正";
  }

  if (parsed?.token !== expectedToken) return "token が不一致";

  return null;
}

const misses = [];
let htmlCount = 0;

for await (const file of walkHtml(DIST_DIR)) {
  htmlCount++;
  const html = await readFile(file, "utf8");
  const issue = findBeaconIssue(html);
  if (issue) misses.push({ file, issue });
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
  for (const { file, issue } of misses) console.error(`  ${file}: ${issue}`);
  process.exit(1);
}

console.log(
  `check-beacon-gate: OK (Cloudflare Web Analytics ビーコンが ${htmlCount} 件全ページで出力されています)`
);
