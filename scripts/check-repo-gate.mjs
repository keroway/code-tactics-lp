import { readFile } from "node:fs/promises";
import { walkHtml } from "./lib/walk-html.mjs";

/**
 * `REPO_IS_PUBLIC` ゲート（src/consts.ts）が効いているかをビルド成果物で検証する。
 *
 * ## なぜ必要か（#143）
 *
 * このゲートは HeroSection / SiteFooter / FooterCta / 404 の 4 ファイルに波及するが、
 * 壊れたことを検出する仕組みが 1 つも無かった（#143 執筆当時。以降 #218 で
 * `check-repo-gate.test.mjs` によるフィクスチャテストが追加されたが、それは
 * このスクリプト自身のロジックを対象とするユニットテストで、実際の `dist/`
 * ビルド成果物に対する end-to-end 的な検証ではない。このスクリプトはその
 * 後者を担うため、フィクスチャテストの追加後も引き続き必要）。
 * 唯一検出しうる lychee のリンク検査は `lychee.toml` で当の URL を除外している:
 *
 *     exclude = ['^https://github\.com/keroway/code-tactics/?$']
 *
 * 除外自体は「意図的なリンクで CI を恒久的に落とさない」ための妥当な判断だが、
 * その結果として lychee 側の検出手段がゼロになっていた。
 *
 * ## 両方向を見る
 *
 * 未公開側だけを検査すると、`PUBLIC_REPO_PUBLIC=true` に倒した瞬間に
 * 何も検証しなくなる。公開側も見ることで、**public 化したのに env の設定漏れで
 * リンクが復活していない**ことも検出できる。ゲートが env 由来である以上、
 * ズレは両方向に起きうる。
 */

const DIST_DIR = "dist";

// 本体ゲームリポジトリ。LP 自身（`-lp` 接尾）は対象外にする。
// 否定先読みは `-lp` ではなく**リポジトリ名に使える文字全般**を弾く。
// `(?!-lp)` だと `code-tactics-docs` や `code-tactics2` のような別リポジトリまで
// 拾ってしまい、無関係な URL で CI が落ちる。
// `/issues` や末尾の `"` は文字クラス外なので、意図どおり一致する。
// 先頭を `^` で固定する（#271）。固定しないと
// `https://example.invalid/?next=https://github.com/keroway/code-tactics` のように
// 別サイトのクエリに本体 URL を含む href まで本体リンクとして数えてしまう。
// scheme / host は大文字小文字を区別しないので `i` を付ける。
// URL 全体ではなく、ページ URL 基準で解決した後の pathname に適用する（#295）。
const REPO_PATH_PATTERN = /^\/keroway\/code-tactics(?![A-Za-z0-9._-])/i;

// href の解決基準。プロトコル相対 `//github.com/...` は https のページ上で
// https に解決されるため、基準は LP の HTTPS URL とする。
const PAGE_URL = "https://keroway.github.io/code-tactics-lp/";

// ブラウザと同じ URL 解決で、プロトコル相対表記や明示ポート（`:443`）も
// 正規化してから origin と pathname を比べる（#295）。
function isRepoHref(href) {
  let url;
  try {
    url = new URL(href, PAGE_URL);
  } catch {
    return false;
  }
  return (
    url.origin === "https://github.com" && REPO_PATH_PATTERN.test(url.pathname)
  );
}

// HTML コメントやプレーンテキストの URL 出現は成功/失敗の判定に数えない
// （#231）。実際にクリックできる <a href> だけを本体リンクとして扱う。
const ANCHOR_PATTERN = /<a\b[^>]*>/gi;
// 属性値は二重引用符・単一引用符・引用符なしの 3 表記を受ける（#285）。
// 引用符なしは HTML の定義どおり空白・引用符・`=<>` と backtick を含まない値。
const HREF_PATTERN = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

// URL 判定に影響しうる最小限の HTML 文字参照（#285）。
// 数値参照（10 進・16 進）は全て復号し、名前付きは URL 内で使われうるものに限る。
const NAMED_ENTITIES = {
  amp: "&",
  colon: ":",
  sol: "/",
  period: ".",
  hyphen: "-",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  Tab: "\t",
  NewLine: "\n",
};

function decodeCharRef(match, hex, dec, name) {
  if (name !== undefined) return NAMED_ENTITIES[name] ?? match;
  const code = hex !== undefined ? Number.parseInt(hex, 16) : Number(dec);
  if (!Number.isInteger(code) || code > 0x10ffff) return match;
  return String.fromCodePoint(code);
}

// ブラウザの href 解釈に合わせ、文字参照を復号してから前後の空白と
// 途中の tab / 改行を取り除く（URL パーサが除去する文字）。
function normalizeHref(raw) {
  return raw
    .replace(
      /&(?:#[xX]([0-9a-fA-F]+);?|#([0-9]+);?|([A-Za-z]+);)/g,
      decodeCharRef
    )
    .replace(/[\t\n\r]/g, "")
    .trim();
}

// 公開時に本体リンクを持つべきページ（dist/ 相対）。
// SiteFooter / FooterCta は全ページ共通だが、トップページと 404 は
// astro.config.mjs の base 設定に関わらずこのパスに出力される
// （check-sitemap.mjs の EXPECTED_PAGES と同じ前提）。
const REQUIRED_PUBLIC_FILES = ["index.html", "404.html"];

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

// dist/ のファイルパスは走査元 DIST_DIR からの相対パスなので、
// REQUIRED_PUBLIC_FILES と比較できるよう DIST_DIR プレフィックスを剥がす。
function relativeToDist(file) {
  return file.startsWith(`${DIST_DIR}/`)
    ? file.slice(DIST_DIR.length + 1)
    : file;
}

function countRepoAnchors(html) {
  let count = 0;
  for (const anchor of stripComments(html).matchAll(ANCHOR_PATTERN)) {
    const hrefMatch = anchor[0].match(HREF_PATTERN);
    if (!hrefMatch) continue;
    const raw = hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3];
    if (isRepoHref(normalizeHref(raw))) count++;
  }
  return count;
}

// ビルド時と同じ判定（src/consts.ts の REPO_IS_PUBLIC と揃える）。
const repoIsPublic = process.env.PUBLIC_REPO_PUBLIC === "true";

const hits = [];
const requiredFileHits = new Map(
  REQUIRED_PUBLIC_FILES.map((name) => [name, 0])
);
let htmlCount = 0;

for await (const file of walkHtml(DIST_DIR)) {
  htmlCount++;
  const html = await readFile(file, "utf8");
  const count = countRepoAnchors(html);
  if (count > 0) hits.push({ file, count });
  const relPath = relativeToDist(file);
  if (requiredFileHits.has(relPath)) requiredFileHits.set(relPath, count);
}

// 走査対象が 0 件だと、どちらの判定も素通りしてしまう。
// 「ビルドし忘れ」を成功と読み違えないための前提チェック。
if (htmlCount === 0) {
  console.error(
    `${DIST_DIR}/ に HTML がありません。先に \`pnpm run build\` を実行してください。`
  );
  process.exit(1);
}

if (!repoIsPublic && hits.length > 0) {
  console.error(
    "本体リポジトリは非公開の想定ですが、その URL が出力に含まれています。"
  );
  console.error(
    "未ログイン訪問者には 404 になります（REPO_IS_PUBLIC ゲートの漏れ）。"
  );
  for (const { file, count } of hits) console.error(`  ${file}: ${count} 件`);
  process.exit(1);
}

if (repoIsPublic && hits.length === 0) {
  console.error(
    "PUBLIC_REPO_PUBLIC=true でビルドされましたが、本体リポジトリへのリンクが 1 件もありません。"
  );
  console.error(
    "ゲートの分岐か env の設定漏れが疑われます（公開したのに「準備中」表示のまま）。"
  );
  process.exit(1);
}

// 全体では 1 件以上あっても、特定ページ（トップ / 404）だけ CTA が
// 欠落している部分欠落を見逃さないための個別チェック（#231）。
if (repoIsPublic) {
  const missingFiles = REQUIRED_PUBLIC_FILES.filter(
    (name) => requiredFileHits.get(name) === 0
  );
  if (missingFiles.length > 0) {
    console.error(
      "PUBLIC_REPO_PUBLIC=true ですが、次のページに本体リンクがありません。"
    );
    for (const name of missingFiles) console.error(`  ${DIST_DIR}/${name}`);
    process.exit(1);
  }
}

const state = repoIsPublic ? "public" : "private";
console.log(
  `check-repo-gate: OK (REPO_IS_PUBLIC=${state}, HTML ${htmlCount} 件, 本体リンク ${hits.length} 件)`
);
