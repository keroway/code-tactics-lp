import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runScript, withTmpDir } from "./lib/spawn-script.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-repo-gate.mjs"
);
const REPO_LINK = '<a href="https://github.com/keroway/code-tactics">link</a>';

function writeDistHtml(tmp, name, content) {
  const full = join(tmp, "dist", name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

test("dist/ に HTML が無ければ失敗する", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm run build/);
  });
});

test("非公開想定なのに本体リンクが残っていれば失敗する", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", REPO_LINK);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /非公開の想定ですが/);
  });
});

test("非公開想定でリンクが無ければ成功する", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", "<p>no link</p>");
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});

test("公開想定なのにリンクが無ければ失敗する", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", "<p>no link</p>");
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /本体リポジトリへのリンクが 1 件もありません/);
  });
});

test("公開想定でリンクがあれば成功する", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", REPO_LINK);
    writeDistHtml(tmp, "404.html", REPO_LINK);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});

test("否定先読みは別リポジトリの URL を誤検出しない", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<a href="https://github.com/keroway/code-tactics-docs">unrelated</a>'
    );
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 0);
  });
});

const FOREIGN_LINK =
  '<a href="https://example.invalid/?next=https://github.com/keroway/code-tactics">x</a>';

test("非公開想定で別サイトのクエリ内の本体 URL は流出と見なさない（#271）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", FOREIGN_LINK);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 0);
  });
});

test("公開想定で別サイトのクエリ内の本体 URL は本体リンクに数えない（#271）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", FOREIGN_LINK);
    writeDistHtml(tmp, "404.html", REPO_LINK);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /次のページに本体リンクがありません[\s\S]*index\.html/
    );
  });
});

// 引用符なし属性・文字参照・単一引用符の表記ゆれ（#285）。
const NOTATION_VARIANTS = [
  ["引用符なし", "<a href=https://github.com/keroway/code-tactics>x</a>"],
  ["単一引用符", "<a href='https://github.com/keroway/code-tactics'>x</a>"],
  [
    "10 進文字参照",
    '<a href="https&#58;//github.com/keroway/code-tactics">x</a>',
  ],
  [
    "16 進文字参照",
    '<a href="https&#x3a;&#x2F;&#x2f;github.com/keroway/code-tactics">x</a>',
  ],
  [
    "名前付き文字参照",
    '<a href="https&colon;&sol;&sol;github.com/keroway/code-tactics">x</a>',
  ],
  [
    "引用符なしと文字参照の併用",
    "<a href=https&colon;//github.com/keroway/code-tactics>x</a>",
  ],
];

for (const [label, link] of NOTATION_VARIANTS) {
  test(`非公開想定で本体リンクの表記ゆれ（${label}）も流出として検出する（#285）`, async () => {
    await withTmpDir("check-repo-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", link);
      const result = runScript(SCRIPT, {
        cwd: tmp,
        unset: ["PUBLIC_REPO_PUBLIC"],
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /非公開の想定ですが/);
    });
  });

  test(`公開想定で本体リンクの表記ゆれ（${label}）も本体リンクに数える（#285）`, async () => {
    await withTmpDir("check-repo-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", link);
      writeDistHtml(tmp, "404.html", link);
      const result = runScript(SCRIPT, {
        cwd: tmp,
        env: { PUBLIC_REPO_PUBLIC: "true" },
      });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /OK/);
    });
  });
}

test("引用符なし・文字参照でも別リポジトリと別サイトのクエリは本体リンクに数えない（#285）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      [
        "<a href=https://github.com/keroway/code-tactics-docs>a</a>",
        '<a href="https&colon;//github.com/keroway/code-tactics2">b</a>',
        "<a href=https://example.invalid/?next=https://github.com/keroway/code-tactics>c</a>",
      ].join("\n")
    );
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_REPO_PUBLIC"],
    });
    assert.equal(result.status, 0);
  });
});

test("公開想定でコメント内の URL しかなければ失敗する（#231）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      "<!-- https://github.com/keroway/code-tactics -->"
    );
    writeDistHtml(tmp, "404.html", "<p>GitHub（準備中）</p>");
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /本体リポジトリへのリンクが 1 件もありません/);
  });
});

test("公開想定でプレーンテキストの URL しかなければ失敗する（#231）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      "<p>https://github.com/keroway/code-tactics</p>"
    );
    writeDistHtml(tmp, "404.html", REPO_LINK);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /次のページに本体リンクがありません[\s\S]*index\.html/
    );
  });
});

test("公開想定で 404 ページだけリンクが欠落していれば失敗する（部分欠落, #231）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", REPO_LINK);
    writeDistHtml(tmp, "404.html", "<p>GitHub（準備中）</p>");
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /次のページに本体リンクがありません[\s\S]*404\.html/
    );
  });
});
