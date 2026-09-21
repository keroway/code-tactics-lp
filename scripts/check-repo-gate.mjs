import { readFile } from "node:fs/promises";
import { walkHtml } from "./lib/walk-html.mjs";

/**
 * `REPO_IS_PUBLIC` ゲート（src/consts.ts）が効いているかをビルド成果物で検証する。
 *
 * ## なぜ必要か（#143）
 *
 * このゲートは HeroSection / SiteFooter / FooterCta / 404 の 4 ファイルに波及するが、
 * 壊れたことを検出する仕組みが 1 つも無かった。このリポジトリにはテスト基盤が無く
 * （vitest も Playwright も入っていない）、唯一検出しうる lychee のリンク検査は
 * `lychee.toml` で当の URL を除外している:
 *
 *     exclude = ['^https://github\.com/keroway/code-tactics/?$']
 *
 * 除外自体は「意図的なリンクで CI を恒久的に落とさない」ための妥当な判断だが、
 * その結果として検出手段がゼロになっていた。
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
const REPO_URL_PATTERN =
  /https:\/\/github\.com\/keroway\/code-tactics(?![A-Za-z0-9._-])/;

// HTML コメントやプレーンテキストの URL 出現は成功/失敗の判定に数えない
// （#231）。実際にクリックできる <a href> だけを本体リンクとして扱う。
const ANCHOR_PATTERN = /<a\b[^>]*>/gi;
const HREF_PATTERN = /\shref\s*=\s*(["'])(.*?)\1/i;

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
    if (hrefMatch && REPO_URL_PATTERN.test(hrefMatch[2])) count++;
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
