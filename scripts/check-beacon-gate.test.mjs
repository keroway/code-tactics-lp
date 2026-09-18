import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runScript, withTmpDir } from "./lib/spawn-script.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-beacon-gate.mjs"
);
const BEACON_TAG =
  '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>';

function writeDistHtml(tmp, name, content) {
  const full = join(tmp, "dist", name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

test("トークン未設定なら SKIP して成功する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_CF_BEACON_TOKEN"],
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /SKIP/);
  });
});

test("トークン設定時に dist/ が空なら失敗する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_CF_BEACON_TOKEN: "dummy" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm run build/);
  });
});

test("トークン設定時にビーコンタグが欠けているページがあれば失敗する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG);
    writeDistHtml(tmp, "privacy/index.html", "<p>no beacon</p>");
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_CF_BEACON_TOKEN: "dummy" },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /ビーコンタグが出力されていないページがあります/
    );
  });
});

test("トークン設定時に全ページでビーコンタグがあれば成功する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG);
    writeDistHtml(tmp, "privacy/index.html", BEACON_TAG);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_CF_BEACON_TOKEN: "dummy" },
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});
