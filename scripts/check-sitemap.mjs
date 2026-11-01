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
const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const EXPECTED_INDEX_URL = `${SITE_URL}/sitemap-index.xml`;
const EXPECTED_SITEMAP_URL = `${SITE_URL}/sitemap-0.xml`;

// XML コメント内の要素は実在しない扱いにする（#366）。コメント内だけに
// 期待 URL がある sitemap を成功にしない / コメント内の想定外 URL で落とさない。
function stripXmlComments(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

// 開始/終了タグの対応と単一ルートを検査する（#368）。loc の抽出は正規表現なので、
// 閉じタグ欠落などの不正な文書を URL 比較だけで成功にしないための前段ゲート。
// 不正なら理由の文字列、正常なら null を返す。
function findXmlSyntaxError(xml) {
  const body = stripXmlComments(xml)
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const tagRe =
    /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  let roots = 0;
  let rest = "";
  let last = 0;
  // ルート要素の外（スタックが空）にある空白以外の文字列を拒否する（#374）。
  const outsideText = (text) => stack.length === 0 && /\S/.test(text);
  for (const m of body.matchAll(tagRe)) {
    const gap = body.slice(last, m.index);
    if (outsideText(gap)) return "ルート要素の外に文字列があります";
    rest += gap;
    last = m.index + m[0].length;
    const [, closing, name, , selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      if (open !== name) {
        return `閉じタグ </${name}> が開始タグ ${open ? `<${open}>` : "(なし)"} と対応しません`;
      }
    } else {
      if (stack.length === 0) roots += 1;
      if (!selfClosing) stack.push(name);
    }
  }
  const tail = body.slice(last);
  if (outsideText(tail)) return "ルート要素の外に文字列があります";
  rest += tail;
  if (rest.includes("<")) return "解釈できない '<' が含まれています";
  if (stack.length > 0) return `閉じタグ </${stack.at(-1)}> がありません`;
  if (roots !== 1) return `ルート要素が ${roots} 個あります`;
  return null;
}

// コメント・処理命令・CDATA を除いた、要素として実在する部分だけの文字列（#370）。
function stripNonElements(xml) {
  return stripXmlComments(xml)
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
}

// `<root><parent><loc>…</loc></parent></root>` の階層にある loc だけを集める
// （#366, #370）。ルート名が違う文書・標準 namespace を宣言しない文書は
// 理由の文字列を error に返す。sitemapindex は parent="sitemap"、urlset は
// parent="url"。CDATA 内の文字列は要素として数えない。
function extractLocs(xml, root, parent) {
  const body = stripNonElements(xml);
  const tagRe =
    /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const path = [];
  const nsStack = [];
  const locs = [];
  let error = null;
  let locStart = null;
  for (const m of body.matchAll(tagRe)) {
    const [, closing, name, attrs, selfClosing] = m;
    if (closing) {
      if (
        locStart !== null &&
        name === "loc" &&
        path.join("/") === `${root}/${parent}/loc`
      ) {
        locs.push(body.slice(locStart, m.index).trim());
        locStart = null;
      }
      path.pop();
      nsStack.pop();
      continue;
    }
    if (path.length === 0) {
      if (name !== root) {
        error = `ルート要素が <${root}> ではなく <${name}> です`;
      } else if (
        !new RegExp(`\\sxmlns\\s*=\\s*(["'])${SITEMAP_NS}\\1`).test(attrs)
      ) {
        error = `<${root}> に標準 namespace ${SITEMAP_NS} の宣言がありません`;
      }
    }
    // 子要素での xmlns 再宣言・解除（#372）。有効な default namespace を継承
    // しながら追跡し、root/parent/loc が標準 namespace を外れたら拒否する。
    const declared = attrs.match(/\sxmlns\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const ns = declared ? (declared[1] ?? declared[2]) : nsStack.at(-1);
    const chain = `${root}/${parent}/loc`;
    const here = [...path, name].join("/");
    if (
      !error &&
      (chain === here || chain.startsWith(`${here}/`)) &&
      ns !== SITEMAP_NS
    ) {
      error = `<${name}> が標準 namespace ${SITEMAP_NS} に属していません`;
    }
    if (selfClosing) continue;
    path.push(name);
    nsStack.push(ns);
    if (name === "loc" && path.join("/") === `${root}/${parent}/loc`) {
      locStart = m.index + m[0].length;
    }
  }
  return { locs, error };
}

let indexXml;
let sitemapXml;
let robotsTxt;
let distRobotsTxt;

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

try {
  distRobotsTxt = await readFile(`${DIST_DIR}/robots.txt`, "utf8");
} catch {
  console.error(
    `${DIST_DIR}/robots.txt が見つかりません。public/robots.txt がビルド成果物にコピーされていません。`
  );
  process.exit(1);
}

for (const [name, xml] of [
  ["sitemap-index.xml", indexXml],
  ["sitemap-0.xml", sitemapXml],
]) {
  const syntaxError = findXmlSyntaxError(xml);
  if (syntaxError) {
    console.error(`${name} が正しい XML ではありません: ${syntaxError}`);
    process.exit(1);
  }
}

const { locs: indexLocs, error: indexError } = extractLocs(
  indexXml,
  "sitemapindex",
  "sitemap"
);
if (indexError) {
  console.error(
    `sitemap-index.xml が正しい sitemap ではありません: ${indexError}`
  );
  process.exit(1);
}
if (indexLocs.length !== 1 || indexLocs[0] !== EXPECTED_SITEMAP_URL) {
  console.error(
    `sitemap-index.xml が参照する URL が想定と異なります: ${JSON.stringify(indexLocs)}`
  );
  console.error(`  期待値: ["${EXPECTED_SITEMAP_URL}"]`);
  process.exit(1);
}

const { locs: sitemapLocs, error: sitemapError } = extractLocs(
  sitemapXml,
  "urlset",
  "url"
);
if (sitemapError) {
  console.error(
    `sitemap-0.xml が正しい sitemap ではありません: ${sitemapError}`
  );
  process.exit(1);
}
const sitemapUrls = new Set(sitemapLocs);
const missing = [...EXPECTED_URLS].filter((url) => !sitemapUrls.has(url));
const unexpected = [...sitemapUrls].filter((url) => !EXPECTED_URLS.has(url));

if (missing.length > 0 || unexpected.length > 0) {
  console.error("sitemap-0.xml の収録URLが想定と一致しません。");
  for (const url of missing) console.error(`  不足: ${url}`);
  for (const url of unexpected) console.error(`  想定外: ${url}`);
  process.exit(1);
}

function extractSitemapUrl(txt) {
  const line = txt.split("\n").find((l) => l.startsWith("Sitemap:"));
  return line?.slice("Sitemap:".length).trim();
}

const robotsSitemapUrl = extractSitemapUrl(robotsTxt);

if (robotsSitemapUrl !== EXPECTED_INDEX_URL) {
  console.error(
    `robots.txt の Sitemap: 行が sitemap-index.xml の URL と一致しません。`
  );
  console.error(`  robots.txt: ${robotsSitemapUrl ?? "(見つかりません)"}`);
  console.error(`  期待値: ${EXPECTED_INDEX_URL}`);
  process.exit(1);
}

const distRobotsSitemapUrl = extractSitemapUrl(distRobotsTxt);

if (distRobotsSitemapUrl !== EXPECTED_INDEX_URL) {
  console.error(
    `${DIST_DIR}/robots.txt の Sitemap: 行が sitemap-index.xml の URL と一致しません。`
  );
  console.error(
    `  ${DIST_DIR}/robots.txt: ${distRobotsSitemapUrl ?? "(見つかりません)"}`
  );
  console.error(`  期待値: ${EXPECTED_INDEX_URL}`);
  process.exit(1);
}

console.log(
  `check-sitemap: OK (sitemap-0.xml ${sitemapUrls.size} 件, robots.txt 整合)`
);
