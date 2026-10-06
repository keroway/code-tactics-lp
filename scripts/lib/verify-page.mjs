// axe スモークが「検査対象ページに正しく到達したか」を判定する純粋関数 (#275)。
// エラー応答や別ページへのリダイレクトを axe 結果だけで成功扱いしないために使う。

/**
 * @param {{ status: number | null, finalUrl: string, title: string }} actual
 * @param {{ url: string, titleIncludes: string }} expected
 * @returns {string[]} 不一致の説明 (空なら OK)
 */
export function verifyPage(actual, expected) {
  const problems = [];
  if (actual.status !== 200) {
    problems.push(`HTTP status is ${actual.status} (expected 200)`);
  }
  if (actual.finalUrl !== expected.url) {
    problems.push(
      `final URL is ${actual.finalUrl} (expected ${expected.url}; redirected?)`
    );
  }
  if (!actual.title.includes(expected.titleIncludes)) {
    problems.push(
      `title "${actual.title}" does not include "${expected.titleIncludes}"`
    );
  }
  return problems;
}
