import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { stripInertHtml } from "./lib/strip-inert-html.mjs";
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
 * （実際にフォールバック中でも検出できない）。HTML コメント・script 内の文字列・
 * 未展開 template を除去した上で（#301）
 * 実際の `<video data-motion-optional>` 要素を取り出し、その `poster` 属性と
 * 配下の `<source>` の `src` を個別に検査する。
 */

const DIST_DIR = "dist";
const HERO_ASSETS = ["hero-poster.jpg", "hero-battle.webm", "hero-battle.mp4"];
const HERO_SOURCE_TYPES = {
  "hero-battle.webm": "video/webm",
  "hero-battle.mp4": "video/mp4",
};
// 開始タグの終端は引用符の外の `>` だけ。引用符付き属性値内の `>` で切らない(#318)。
const VIDEO_ELEMENT_PATTERN =
  /<video\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/video>/gi;
const SOURCE_TAG_PATTERN = /<source\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
// 属性を名前単位で読む。`title="poster='...'"` のような他属性の値の中身を
// poster / src と誤認しない。data-poster / data-src も名前が一致しないので除外される(#267, #318)。
const ATTRIBUTE_PATTERN =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

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
  let heroVideo;
  // video・source 以外の開始タグは属性ごと除去し、別要素の属性値に埋まった
  // 疑似 video / source を実要素と数えない(#324)。
  const inertFree = stripInertHtml(html, {
    keepTags: ["video", "source"],
    dropNoscript: true,
  });
  for (const m of inertFree.matchAll(VIDEO_ELEMENT_PATTERN)) {
    const attrs = parseAttributes(m[1]);
    if (attrs.some((a) => a.name === "data-motion-optional")) {
      heroVideo = { attrs, innerHtml: m[2] };
      break;
    }
  }
  if (!heroVideo) return "静止画フォールバックで出力されています";

  const poster = findAttrValue(heroVideo.attrs, "poster");
  if (poster === undefined || !refersToAsset(poster, "hero-poster.jpg")) {
    return "video の poster 属性に hero-poster.jpg が指定されていません";
  }

  // video 自身に src があると子 source は無視される。source 検査が有効な
  // 構造（src なし）であることを契約として保証する(#338)。
  if (findAttrValue(heroVideo.attrs, "src") !== undefined) {
    return "video 自身に src 属性があります（子 source の検査が無効になります）";
  }

  // media 属性付きの source は条件次第で選ばれないため、必須アセットとして数えない。
  // 現在の Hero は media を使わない契約（media="not all" で再生不能になる穴を塞ぐ, #340）。
  const sources = [...heroVideo.innerHtml.matchAll(SOURCE_TAG_PATTERN)]
    .map((m) => parseAttributes(m[1]))
    .filter((attrs) => findAttrValue(attrs, "media") === undefined)
    .map((attrs) => ({
      src: findAttrValue(attrs, "src"),
      type: findAttrValue(attrs, "type"),
    }))
    .filter((s) => s.src !== undefined);
  const missing = Object.keys(HERO_SOURCE_TYPES).filter(
    (name) => !sources.some((s) => refersToAsset(s.src, name))
  );

  if (missing.length > 0) {
    return `source の src に ${missing.join(", ")} がありません`;
  }

  // type は必須で、拡張子と対応する MIME タイプだけを受理する。type の省略や
  // webm/mp4 の取り違えは、ブラウザが形式を選別できず再生不能になりうる(#344)。
  // 同じファイルを指す source が複数あるときは、どれかが正しければ足りる。
  const wrongType = Object.entries(HERO_SOURCE_TYPES)
    .filter(
      ([name, mime]) =>
        !sources.some(
          (s) =>
            refersToAsset(s.src, name) && s.type?.trim().toLowerCase() === mime
        )
    )
    .map(([name, mime]) => `${name}(${mime})`);

  if (wrongType.length > 0) {
    return `source の type が不正または未指定です: ${wrongType.join(", ")}`;
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

// HTML の参照が正しくても、配布する実ファイルが欠けていれば動画は再生できない(#280)。
async function findMissingAsset(names) {
  for (const name of names) {
    try {
      const info = await stat(join(DIST_DIR, name));
      if (!info.isFile())
        return `${DIST_DIR}/${name} が通常ファイルではありません`;
      if (info.size === 0) return `${DIST_DIR}/${name} が空ファイルです`;
    } catch {
      return `${DIST_DIR}/${name} が存在しません`;
    }
  }
  return null;
}

const issue =
  findHeroVideoIssue(indexHtml) ?? (await findMissingAsset(HERO_ASSETS));

if (issue) {
  console.error(`Hero 動画セクションの検査に失敗しました: ${issue}`);
  console.error(
    "public/hero-battle.webm / hero-battle.mp4 / hero-poster.jpg の欠落が疑われます。"
  );
  process.exit(1);
}

console.log("check-hero-video: OK (Hero 動画セクションが出力されています)");
