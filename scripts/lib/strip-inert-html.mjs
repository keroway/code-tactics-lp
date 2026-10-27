// 表示・操作の対象にならない HTML 領域を取り除く(#301)。ビルド成果物ゲートが
// 正規表現でタグを探す前に通す。対象は次の 7 つ。
//   - HTML コメント
//   - <script> の中身(文字列中の疑似タグ)
//   - <textarea> 全体(本文はタグとして解釈されない RCDATA。#308)
//   - <title> 全体(RCDATA。#310)
//   - <style> 全体(生テキスト。#310)
//   - <xmp> 全体(生テキスト。#354)
//   - <template> の中身(未展開で DOM に描画されない要素。入れ子も 1 つとして扱う)
//
// keepScriptTags: true のときは <script> の開始タグだけ残し、中身と閉じタグを除く
// (#303)。script 要素の属性を検査するゲート向けで、template 内の script や
// 外側の script 本文に埋まった疑似タグは従来どおり除去される。
//
// 開始タグの属性部は引用符付き属性値を 1 かたまりで読む(#316)。属性値内の
// `>` や疑似 <template> を領域の開始・終了と誤認しない。その他の開始タグも
// 読み飛ばして残し、属性値の中身を後続トークンとして拾わせない。
const ATTRS = `(?:"[^"]*"|'[^']*'|[^>"'])*`;
const NOSCRIPT = String.raw`<noscript\b${ATTRS}>[\s\S]*?<\/noscript\s*>`;
function buildTokenPattern(dropNoscript) {
  return new RegExp(
    [
      String.raw`<!--[\s\S]*?-->`,
      String.raw`(<script\b${ATTRS}>)[\s\S]*?<\/script\s*>`,
      String.raw`<textarea\b${ATTRS}>[\s\S]*?<\/textarea\s*>`,
      String.raw`<title\b${ATTRS}>[\s\S]*?<\/title\s*>`,
      String.raw`<style\b${ATTRS}>[\s\S]*?<\/style\s*>`,
      String.raw`<xmp\b${ATTRS}>[\s\S]*?<\/xmp\s*>`,
      String.raw`<(\/?)template\b${ATTRS}>`,
      // dropNoscript 時だけ <noscript> 全体を領域として除く(#329)。
      // 無効側はグループ番号を保つため、決して一致しない枝にする
      dropNoscript ? NOSCRIPT : "(?!)",
      String.raw`(<[A-Za-z][^\s/>]*${ATTRS}>)`,
    ].join("|"),
    "gi"
  );
}
const TOKEN_PATTERN = buildTokenPattern(false);
const TOKEN_PATTERN_NO_NOSCRIPT = buildTokenPattern(true);

// keepTags: ["a"] のように要素名を渡すと、その要素以外の通常の開始タグを属性ごと
// 除去する(#322)。別要素の属性値に埋まった疑似 <a>・<script> を実要素として
// 数えさせないため。省略時は従来どおり通常の開始タグをすべて残す。
export function stripInertHtml(
  html,
  { keepScriptTags = false, keepTags = null, dropNoscript = false } = {}
) {
  let out = "";
  let last = 0;
  let depth = 0;
  for (const m of html.matchAll(
    dropNoscript ? TOKEN_PATTERN_NO_NOSCRIPT : TOKEN_PATTERN
  )) {
    const token = m[0];
    // 通常の開始タグ。keepTags 指定時は対象外の要素だけ除去し、それ以外は読み飛ばす
    if (m[3] !== undefined) {
      if (keepTags && depth === 0) {
        const name = /^<([^\s/>]+)/.exec(token)[1].toLowerCase();
        if (!keepTags.includes(name)) {
          out += html.slice(last, m.index);
          last = m.index + token.length;
        }
      }
      continue;
    }
    const isTemplateTag = m[2] !== undefined;
    if (depth === 0) {
      if (isTemplateTag) {
        if (m[2] === "") {
          out += html.slice(last, m.index);
          depth = 1;
        }
        // 対応する開始の無い </template> はそのまま残す
        continue;
      }
      // コメント・script は丸ごと除去する(keepScriptTags なら開始タグは残す)
      out += html.slice(last, m.index);
      if (keepScriptTags && m[1] !== undefined) out += m[1];
      last = m.index + token.length;
    } else if (isTemplateTag) {
      depth += m[2] === "" ? 1 : -1;
      if (depth === 0) last = m.index + token.length;
    }
    // template 内のコメント・script は template ごと捨てるので何もしない
  }
  // 閉じ忘れの <template> 以降は描画されないので捨てる
  if (depth > 0) return out;
  return out + html.slice(last);
}
