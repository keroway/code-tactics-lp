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
  // URL として解決すれば本体リポジトリになる表記（#295）。
  ["プロトコル相対", '<a href="//github.com/keroway/code-tactics">x</a>'],
  [
    "明示ポート 443",
    '<a href="https://github.com:443/keroway/code-tactics">x</a>',
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
        '<a href="//github.com/keroway/code-tactics-docs">d</a>',
        '<a href="https://github.com:8443/other/code-tactics">e</a>',
        '<a href="//example.invalid/github.com/keroway/code-tactics">f</a>',
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

for (const [label, wrap] of [
  ["template", (h) => `<template>${h}</template>`],
  ["script", (h) => `<script type="text/plain">${h}</script>`],
  [
    "入れ子の template",
    (h) => `<template><template>x</template>${h}</template>`,
  ],
]) {
  test(`公開想定で ${label} 内だけの本体リンクは数えず失敗する（#301）`, async () => {
    await withTmpDir("check-repo-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", wrap(REPO_LINK));
      writeDistHtml(tmp, "404.html", wrap(REPO_LINK));
      const result = runScript(SCRIPT, {
        cwd: tmp,
        env: { PUBLIC_REPO_PUBLIC: "true" },
      });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /本体リポジトリへのリンクが 1 件もありません/
      );
    });
  });

  test(`非公開想定で ${label} 内の本体リンクは流出と見なさない（#301）`, async () => {
    await withTmpDir("check-repo-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", wrap(REPO_LINK));
      const result = runScript(SCRIPT, {
        cwd: tmp,
        unset: ["PUBLIC_REPO_PUBLIC"],
      });
      assert.equal(result.status, 0);
    });
  });
}

test("template や script の外にある実リンクは数える（#301）", async () => {
  await withTmpDir("check-repo-gate-", async (tmp) => {
    const html = `<template>x</template>${REPO_LINK}<script>var a = 1;</script>`;
    writeDistHtml(tmp, "index.html", html);
    writeDistHtml(tmp, "404.html", html);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_REPO_PUBLIC: "true" },
    });
    assert.equal(result.status, 0);
  });
});
