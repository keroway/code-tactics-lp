import { readFile } from "node:fs/promises";
import { stripInertHtml } from "./lib/strip-inert-html.mjs";
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
// 不活性領域を除去した後の HTML から <script ...> の開始タグだけを拾う。
// コメント等に URL 文字列だけが残っているケースを実タグと誤認しないための前提。
// 開始タグの終端は引用符の外の `>` だけ。属性値内の `>` で切らない(#320)。
const SCRIPT_TAG_PATTERN = /<script\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
// 属性を名前単位で読む。他属性の値の中身を src / type / data-cf-beacon と
// 誤認しない。data-src も名前が一致しないので除外される(#267, #320)。
const ATTRIBUTE_PATTERN =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

function parseAttributes(attributes) {
  return [...attributes.matchAll(ATTRIBUTE_PATTERN)].map((m) => ({
    name: m[1].toLowerCase(),
    value: m[2] ?? m[3] ?? m[4],
  }));
}

// 重複属性はブラウザ同様、最初のものが有効。
function findAttrValue(attrs, name) {
  return attrs.find((a) => a.name === name)?.value;
}
// ブラウザが外部 script として実行する type(WHATWG HTML の JavaScript MIME type
// と module)。application/json や text/plain はデータブロック扱いで実行されない。
const EXECUTABLE_TYPE_PATTERN =
  /^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma|jscript|live)script)$/i;

// Astro の属性レンダラー(html-escaper の escape)が生成しうる 5 種類の実体参照。
// data-cf-beacon={JSON.stringify(...)} はここでエスケープされてから出力されるため、
// JSON.parse の前に同じ対応表で復号する必要がある(#229)。
const HTML_ENTITY_PATTERN = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;
const HTML_ENTITIES = {
  "&amp;": "&",
  "&#38;": "&",
  "&lt;": "<",
  "&#60;": "<",
  "&gt;": ">",
  "&#62;": ">",
  "&apos;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&#34;": '"',
};
const decodeHtmlEntities = (value) =>
  value.replace(HTML_ENTITY_PATTERN, (entity) => HTML_ENTITIES[entity]);

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
  // コメント・未展開 template・script 本文内の疑似タグは実行されないので除く(#303)。
  const live = stripInertHtml(html, { keepScriptTags: true });
  const scriptAttrs = [...live.matchAll(SCRIPT_TAG_PATTERN)].map((m) =>
    parseAttributes(m[1])
  );
  const beaconAttrs = scriptAttrs.find(
    (attrs) => findAttrValue(attrs, "src")?.toLowerCase() === BEACON_SRC
  );

  if (!beaconAttrs) return "missing script";

  // type 無し・空文字列は classic script として実行される。それ以外は
  // JavaScript の MIME type か module のときだけ実行対象とみなす(#297)。
  const scriptType = (findAttrValue(beaconAttrs, "type") ?? "").trim();
  if (scriptType !== "" && !EXECUTABLE_TYPE_PATTERN.test(scriptType)) {
    return "script の type が実行対象外";
  }

  const beaconAttr = findAttrValue(beaconAttrs, "data-cf-beacon");
  if (beaconAttr === undefined) return "data-cf-beacon 属性が無い";

  let parsed;
  try {
    parsed = JSON.parse(decodeHtmlEntities(beaconAttr));
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
