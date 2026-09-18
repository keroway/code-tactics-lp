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
