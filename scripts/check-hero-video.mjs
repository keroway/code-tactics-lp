import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { walkHtml } from "./lib/walk-html.mjs";

/**
 * Hero 動画アセットの静止画フォールバックが誤って発火していないかを
 * ビルド成果物で検証する。
 *
 * ## なぜ必要か（#170）
 *
 * `src/components/HeroSection.astro` は `public/hero-battle.webm` /
 * `hero-battle.mp4` / `hero-poster.jpg` の3ファイルを `existsSync` で
 * チェックし、1つでも欠けていれば静止画スクリーンショットへ静かに
 * フォールバックする。この3ファイルは `.gitignore` 対象ではなく
 * git 管理下の実アセットなので、本来は常に存在してビルドされるべきだが、
 * `git rm` の取りこぼしや rebase・cherry-pick の事故で失われても、
 * `pnpm run check` / `smoke:a11y` / `lhci` はいずれもフォールバックを
 * 正常系として扱うため検出できない。`check-repo-gate.mjs`（#143）と
 * 同じ「意図の分岐が壊れても CI で気づけない」パターン。
 *
 * ## なぜ実要素を検査するか（#235）
 *
 * HTML 全体に対する正規表現だけで判定すると、コメントアウトされた
 * video 要素やテキスト中のアセット名の言及だけで成功してしまう
 * （実際にフォールバック中でも検出できない）。HTML コメントを除去した上で
 * 実際の `<video data-motion-optional>` 要素を取り出し、その `poster` 属性と
 * 配下の `<source>` の `src` を個別に検査する。
 */

const DIST_DIR = "dist";
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const VIDEO_ELEMENT_PATTERN =
  /<video\b([^>]*\bdata-motion-optional\b[^>]*)>([\s\S]*?)<\/video>/i;
// 属性名の直前は空白に限る。`\b` だと data-poster / data-src の `poster` / `src` にも
// 一致してしまう(#267)。
const POSTER_ATTR_PATTERN = /(?<=\s)poster\s*=\s*(["'])([\s\S]*?)\1/i;
const SOURCE_SRC_PATTERN =
  /<source\b[^>]*?(?<=\s)src\s*=\s*(["'])([\s\S]*?)\1/gi;

// astro.config.mjs の base と一致させること。末尾セグメントだけの比較だと、
// base 欠落や誤ったディレクトリ配下の参照も通ってしまう(#273)。
const BASE_PATH = "/code-tactics-lp";
const PAGE_URL = new URL(`https://gate.invalid${BASE_PATH}/`);

// 部分一致だと `hero-poster.jpg.missing` のような別ファイルも通ってしまう(#269)。
// トップページの配信 URL を基準に解決し、クエリ・フラグメントを除いたパスが
// `${BASE_PATH}/${name}` と完全一致するかで判定する。
function refersToAsset(url, name) {
  let resolved;
  try {
    resolved = new URL(url.trim(), PAGE_URL);
  } catch {
    return false;
  }
  return (
    resolved.origin === PAGE_URL.origin &&
    resolved.pathname === `${BASE_PATH}/${name}`
  );
}

function findHeroVideoIssue(html) {
  const withoutComments = html.replace(HTML_COMMENT_PATTERN, "");
  const videoMatch = withoutComments.match(VIDEO_ELEMENT_PATTERN);
  if (!videoMatch) return "静止画フォールバックで出力されています";

  const [, openingAttrs, innerHtml] = videoMatch;

  const posterMatch = openingAttrs.match(POSTER_ATTR_PATTERN);
  if (!posterMatch || !refersToAsset(posterMatch[2], "hero-poster.jpg")) {
    return "video の poster 属性に hero-poster.jpg が指定されていません";
  }

  const sourceSrcs = [...innerHtml.matchAll(SOURCE_SRC_PATTERN)].map(
    (m) => m[2]
  );
  const missing = ["hero-battle.webm", "hero-battle.mp4"].filter(
    (name) => !sourceSrcs.some((src) => refersToAsset(src, name))
  );

  if (missing.length > 0) {
    return `source の src に ${missing.join(", ")} がありません`;
  }

  return null;
}

let indexHtml;
let htmlCount = 0;

for await (const file of walkHtml(DIST_DIR)) {
  htmlCount++;
  if (file === join(DIST_DIR, "index.html")) {
    indexHtml = await readFile(file, "utf8");
  }
}

// 走査対象が 0 件だと、フォールバック判定が素通りしてしまう。
// 「ビルドし忘れ」を成功と読み違えないための前提チェック。
if (htmlCount === 0) {
  console.error(
    `${DIST_DIR}/ に HTML がありません。先に \`pnpm run build\` を実行してください。`
  );
  process.exit(1);
}

if (indexHtml === undefined) {
  console.error(`${DIST_DIR}/index.html が見つかりません。`);
  process.exit(1);
}

const issue = findHeroVideoIssue(indexHtml);

if (issue) {
  console.error(`Hero 動画セクションの検査に失敗しました: ${issue}`);
  console.error(
    "public/hero-battle.webm / hero-battle.mp4 / hero-poster.jpg の欠落が疑われます。"
  );
  process.exit(1);
}

console.log("check-hero-video: OK (Hero 動画セクションが出力されています)");
