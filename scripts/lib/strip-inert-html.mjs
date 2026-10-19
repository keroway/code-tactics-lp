// 表示・操作の対象にならない HTML 領域を取り除く(#301)。ビルド成果物ゲートが
// 正規表現でタグを探す前に通す。対象は次の 6 つ。
//   - HTML コメント
//   - <script> の中身(文字列中の疑似タグ)
//   - <textarea> 全体(本文はタグとして解釈されない RCDATA。#308)
//   - <title> 全体(RCDATA。#310)
//   - <style> 全体(生テキスト。#310)
//   - <template> の中身(未展開で DOM に描画されない要素。入れ子も 1 つとして扱う)
//
// keepScriptTags: true のときは <script> の開始タグだけ残し、中身と閉じタグを除く
// (#303)。script 要素の属性を検査するゲート向けで、template 内の script や
// 外側の script 本文に埋まった疑似タグは従来どおり除去される。
const TOKEN_PATTERN =
  /<!--[\s\S]*?-->|(<script\b[^>]*>)[\s\S]*?<\/script\s*>|<textarea\b[^>]*>[\s\S]*?<\/textarea\s*>|<title\b[^>]*>[\s\S]*?<\/title\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<(\/?)template\b[^>]*>/gi;

export function stripInertHtml(html, { keepScriptTags = false } = {}) {
  let out = "";
  let last = 0;
  let depth = 0;
  for (const m of html.matchAll(TOKEN_PATTERN)) {
    const token = m[0];
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
