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
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
const EXPECTED_INDEX_URL = `${SITE_URL}/sitemap-index.xml`;
const EXPECTED_SITEMAP_URL = `${SITE_URL}/sitemap-0.xml`;

// XML コメント内の要素は実在しない扱いにする（#366）。コメント内だけに
// 期待 URL がある sitemap を成功にしない / コメント内の想定外 URL で落とさない。
function stripXmlComments(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

// XML 1.0 の Char 生成規則に収まる符号位置か（#385, #393）。
function isXmlChar(cp) {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

// 定義済み実体（amp/lt/gt/quot/apos）と文字参照以外の `&` を返す（#378）。
// DTD を宣言しない sitemap では、それ以外の実体参照は未定義で整形式エラー。
function findInvalidEntity(text) {
  const bad = text.match(
    /&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);)[^\s&;<]*;?/
  );
  if (bad) return bad[0];
  // 文字参照は XML 1.0 の Char 生成規則に収まる符号位置のみ有効（#385）。
  for (const m of text.matchAll(/&#(?:x([0-9A-Fa-f]+)|([0-9]+));/g)) {
    const cp = m[1] ? Number.parseInt(m[1], 16) : Number.parseInt(m[2], 10);
    if (!isXmlChar(cp)) return m[0];
  }
  return null;
}

// 開始タグの属性領域全体を XML 文法（空白 名前 = 引用符付き値）で先頭から
// 順に消費し、属性名の重複・属性値内の不正な実体参照・文法外の文字列
// （引用符なし属性・値なし属性・値内の `<`）を検査する（#378, #381）。
function findAttributeError(tag, attrs) {
  const seen = new Set();
  // 属性名は XML の Name（ASCII 範囲）に限る（#385）。
  const attrRe = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
  let pos = 0;
  while (pos < attrs.length) {
    if (/^\s*$/.test(attrs.slice(pos))) break;
    attrRe.lastIndex = pos;
    const m = attrRe.exec(attrs);
    if (!m) {
      const near = attrs.slice(pos).trim().slice(0, 20);
      return `<${tag}> の属性が XML 文法に従っていません: ${near}`;
    }
    pos = attrRe.lastIndex;
    if (seen.has(m[1])) return `<${tag}> に属性 ${m[1]} が重複しています`;
    seen.add(m[1]);
    const entity = findInvalidEntity(m[2] ?? m[3]);
    if (entity) {
      return `<${tag}> の属性 ${m[1]} に未定義または不正な実体参照 ${entity} があります`;
    }
  }
  return null;
}

// 開始/終了タグの対応と単一ルートを検査する（#368）。loc の抽出は正規表現なので、
// 閉じタグ欠落などの不正な文書を URL 比較だけで成功にしないための前段ゲート。
// 不正なら理由の文字列、正常なら null を返す。
function findXmlSyntaxError(xml) {
  // 生の文字も XML 1.0 の Char 生成規則に収まる必要がある（#393）。
  // コメント・CDATA・処理命令の中でも許されないので、加工前の全文を検査する。
  for (const ch of xml) {
    const cp = ch.codePointAt(0);
    if (!isXmlChar(cp)) {
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      return `XML で許可されない文字 U+${hex} が含まれています`;
    }
  }
  // コメント本文に `--` は書けず、`--->` で閉じることもできない（#403）。
  for (const m of xml.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (m[1].includes("--") || m[1].endsWith("-")) {
      return "コメント内に '--' が含まれているか '--->' で閉じています";
    }
  }
  const noComments = stripXmlComments(xml);
  // 処理命令は `<?Name ...?>` の文法に従う必要がある。target `xml`（大小無視）は
  // 文書先頭の XML 宣言にだけ許される（#403）。
  for (const m of noComments.matchAll(/<\?([\s\S]*?)\?>/g)) {
    const pi = /^([A-Za-z_:][\w:.-]*)(?:\s[\s\S]*)?$/.exec(m[1]);
    if (!pi)
      return `処理命令が XML 文法に従っていません: <?${m[1].slice(0, 20)}?>`;
    if (
      /^xml$/i.test(pi[1]) &&
      (pi[1] !== "xml" || /\S/.test(noComments.slice(0, m.index)))
    ) {
      return `処理命令の target ${pi[1]} は文書先頭の XML 宣言以外では使えません`;
    }
  }
  const body = noComments
    .replace(/<\?[\s\S]*?\?>/g, "")
    // CDATA は要素内のテキストとしては有効だが、ルート外では文字列扱いにする
    // ため、削除せず非空白のプレースホルダに置き換える（#385）。
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "x");
  const tagRe =
    /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  const scopes = [];
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
    const [, closing, name, attrs, selfClosing] = m;
    if (closing) {
      // 終了タグは名前の後ろに空白以外・自己終了スラッシュを持てない（#383）。
      if (/\S/.test(attrs) || selfClosing) {
        return `閉じタグ </${name}> の名前の後ろに不正な文字列があります`;
      }
      const open = stack.pop();
      scopes.pop();
      if (open !== name) {
        return `閉じタグ </${name}> が開始タグ ${open ? `<${open}>` : "(なし)"} と対応しません`;
      }
    } else {
      const attrError = findAttributeError(name, attrs);
      if (attrError) return attrError;
      const scope = new Map(scopes.at(-1) ?? [["xml", XML_NS]]);
      const attrPairs = [
        ...attrs.matchAll(
          /\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
        ),
      ];
      for (const [, attrName, v1, v2] of attrPairs) {
        if (attrName.startsWith("xmlns:")) {
          const prefix = attrName.slice(6);
          const uri = v1 ?? v2;
          // 予約接頭辞の束縛（Namespaces in XML 1.0 §3）。xmlns 接頭辞は宣言不可、
          // xml 接頭辞は XML_NS 以外に束縛不可、XML_NS を他の接頭辞に束縛するのも不可、
          // XMLNS_NS は束縛不可（#408）。
          if (prefix === "xmlns") {
            return "予約接頭辞 xmlns は宣言できません";
          }
          if (prefix === "xml" && uri !== XML_NS) {
            return `予約接頭辞 xml は ${XML_NS} 以外に束縛できません`;
          }
          if (prefix !== "xml" && uri === XML_NS) {
            return `namespace ${XML_NS} は接頭辞 xml 以外に束縛できません`;
          }
          if (uri === XMLNS_NS) {
            return `namespace ${XMLNS_NS} は束縛できません`;
          }
          scope.set(prefix, uri);
        }
      }
      // 展開名（namespace URI + ローカル名）が同じ属性の重複（#408）。
      // 接頭辞なしの属性は namespace を持たない。
      const expanded = new Set();
      for (const [, attrName] of attrPairs) {
        if (attrName === "xmlns" || attrName.startsWith("xmlns:")) continue;
        const idx = attrName.indexOf(":");
        const uri = idx === -1 ? "" : (scope.get(attrName.slice(0, idx)) ?? "");
        const key = `${uri}\n${attrName.slice(idx + 1)}`;
        if (expanded.has(key)) {
          return `<${name}> に展開名が同じ属性 ${attrName} が重複しています`;
        }
        expanded.add(key);
      }
      // 接頭辞付きの要素名・属性名は、その接頭辞が束縛済みでなければならない（#403）。
      const unbound = [name, ...attrPairs.map((a) => a[1])].find((n) => {
        const parts = n.split(":");
        if (n.startsWith("xmlns:") || n === "xmlns") return false;
        if (parts.length === 1) return false;
        return (
          parts.length > 2 ||
          parts[0] === "" ||
          parts[1] === "" ||
          !scope.get(parts[0])
        );
      });
      if (unbound)
        return `名前 ${unbound} の namespace 接頭辞が宣言されていません`;
      if (stack.length === 0) roots += 1;
      if (!selfClosing) {
        stack.push(name);
        scopes.push(scope);
      }
    }
  }
  const tail = body.slice(last);
  if (outsideText(tail)) return "ルート要素の外に文字列があります";
  rest += tail;
  if (rest.includes("<")) return "解釈できない '<' が含まれています";
  // CDATA 外のテキストに終端文字列 `]]>` は書けない（#393）。
  if (rest.includes("]]>")) return "CDATA 外に ']]>' が含まれています";
  const textEntity = findInvalidEntity(rest);
  if (textEntity) return `未定義または不正な実体参照 ${textEntity} があります`;
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
