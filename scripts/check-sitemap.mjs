import { readFile } from "node:fs/promises";

/**
 * `@astrojs/sitemap` が生成する dist/sitemap-index.xml / dist/sitemap-0.xml と、
 * それを指す public/robots.txt の Sitemap: 行が整合しているかを検証する。
 *
 * ## なぜ必要か（#215）
 *
 * この3つは `astro.config.mjs` の `site` / `base` から機械的に導出されるべき
 * 値だが、それを検証する仕組みが無かった。`check-repo-gate.mjs`（#143）・
 * `check-hero-video.mjs`（#170）と同じ「ビルド成果物として出力されるが
 * 検証手段がゼロ」の穴。site / base の変更漏れや `@astrojs/sitemap` の
 * 出力形式変更、収録ページの過不足を検出する。
 */

const DIST_DIR = "dist";
const SITE_URL = "https://keroway.github.io/code-tactics-lp";
// 公開すべきページのみ。404.html は @astrojs/sitemap が既定で除外する。
const EXPECTED_PAGES = ["/", "/privacy/"];
const EXPECTED_URLS = new Set(
  EXPECTED_PAGES.map((page) => `${SITE_URL}${page}`)
);
const EXPECTED_INDEX_URL = `${SITE_URL}/sitemap-index.xml`;
const EXPECTED_SITEMAP_URL = `${SITE_URL}/sitemap-0.xml`;

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

let indexXml;
let sitemapXml;
let robotsTxt;

try {
  indexXml = await readFile(`${DIST_DIR}/sitemap-index.xml`, "utf8");
} catch {
  console.error(
    `${DIST_DIR}/sitemap-index.xml が見つかりません。先に \`pnpm run build\` を実行してください。`
  );
  process.exit(1);
}

try {
  sitemapXml = await readFile(`${DIST_DIR}/sitemap-0.xml`, "utf8");
} catch {
  console.error(`${DIST_DIR}/sitemap-0.xml が見つかりません。`);
  process.exit(1);
}

try {
  robotsTxt = await readFile("public/robots.txt", "utf8");
} catch {
  console.error("public/robots.txt が見つかりません。");
  process.exit(1);
}

const indexLocs = extractLocs(indexXml);
if (indexLocs.length !== 1 || indexLocs[0] !== EXPECTED_SITEMAP_URL) {
  console.error(
    `sitemap-index.xml が参照する URL が想定と異なります: ${JSON.stringify(indexLocs)}`
  );
  console.error(`  期待値: ["${EXPECTED_SITEMAP_URL}"]`);
  process.exit(1);
}

const sitemapUrls = new Set(extractLocs(sitemapXml));
const missing = [...EXPECTED_URLS].filter((url) => !sitemapUrls.has(url));
const unexpected = [...sitemapUrls].filter((url) => !EXPECTED_URLS.has(url));

if (missing.length > 0 || unexpected.length > 0) {
  console.error("sitemap-0.xml の収録URLが想定と一致しません。");
  for (const url of missing) console.error(`  不足: ${url}`);
  for (const url of unexpected) console.error(`  想定外: ${url}`);
  process.exit(1);
}

const robotsSitemapLine = robotsTxt
  .split("\n")
  .find((line) => line.startsWith("Sitemap:"));
const robotsSitemapUrl = robotsSitemapLine?.slice("Sitemap:".length).trim();

if (robotsSitemapUrl !== EXPECTED_INDEX_URL) {
  console.error(
    `robots.txt の Sitemap: 行が sitemap-index.xml の URL と一致しません。`
  );
  console.error(`  robots.txt: ${robotsSitemapUrl ?? "(見つかりません)"}`);
  console.error(`  期待値: ${EXPECTED_INDEX_URL}`);
  process.exit(1);
}

console.log(
  `check-sitemap: OK (sitemap-0.xml ${sitemapUrls.size} 件, robots.txt 整合)`
);
