import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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
 */

const DIST_DIR = "dist";
const VIDEO_TAG_PATTERN = /<video[^>]*data-motion-optional/;
const REQUIRED_ASSET_PATTERNS = [
  /hero-battle\.webm/,
  /hero-battle\.mp4/,
  /hero-poster\.jpg/,
];

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(path);
    } else if (entry.name.endsWith(".html")) {
      yield path;
    }
  }
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

if (!VIDEO_TAG_PATTERN.test(indexHtml)) {
  console.error(
    "Hero セクションが動画版ではなく静止画フォールバックで出力されています。"
  );
  console.error(
    "public/hero-battle.webm / hero-battle.mp4 / hero-poster.jpg の欠落が疑われます。"
  );
  process.exit(1);
}

const missingAssets = REQUIRED_ASSET_PATTERNS.filter(
  (pattern) => !pattern.test(indexHtml)
);

if (missingAssets.length > 0) {
  console.error(
    "動画要素は出力されていますが、参照先アセットの一部が見つかりません。"
  );
  for (const pattern of missingAssets) console.error(`  ${pattern}`);
  process.exit(1);
}

console.log("check-hero-video: OK (Hero 動画セクションが出力されています)");
