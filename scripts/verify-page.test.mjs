import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPage } from "./lib/verify-page.mjs";

const expected = {
  url: "http://localhost:4321/code-tactics-lp/privacy/",
  titleIncludes: "プライバシー",
};
const ok = {
  status: 200,
  finalUrl: expected.url,
  title: "プライバシー | code-tactics",
};

test("200・最終 URL・タイトルが揃えば問題なし", () => {
  assert.deepEqual(verifyPage(ok, expected), []);
});

test("404 応答は失敗にする", () => {
  assert.equal(verifyPage({ ...ok, status: 404 }, expected).length, 1);
});

test("応答が無い (null) 場合は失敗にする", () => {
  assert.equal(verifyPage({ ...ok, status: null }, expected).length, 1);
});

test("別ページへのリダイレクトは失敗にする", () => {
  const problems = verifyPage(
    {
      ...ok,
      finalUrl: "http://localhost:4321/code-tactics-lp/",
    },
    expected
  );
  assert.equal(problems.length, 1);
});

test("別ページのタイトルは失敗にする", () => {
  const problems = verifyPage({ ...ok, title: "code-tactics —" }, expected);
  assert.equal(problems.length, 1);
});

test("複数の不一致をすべて報告する", () => {
  const problems = verifyPage(
    { status: 500, finalUrl: "http://x/", title: "" },
    expected
  );
  assert.equal(problems.length, 3);
});
