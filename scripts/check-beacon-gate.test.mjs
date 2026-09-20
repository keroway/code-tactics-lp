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
const EXPECTED_TOKEN = "dummy";
const BEACON_TAG = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${EXPECTED_TOKEN}"}'></script>`;
const BEACON_TAG_NO_TOKEN =
  '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>';
const BEACON_TAG_WRONG_TOKEN =
  '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token":"wrong-token"}\'></script>';
const BEACON_TAG_INVALID_JSON =
  "<script defer src=\"https://static.cloudflareinsights.com/beacon.min.js\" data-cf-beacon='not-json'></script>";
const BEACON_URL_IN_COMMENT =
  "<!-- https://static.cloudflareinsights.com/beacon.min.js -->";

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

test("BEACON_GATE_REQUIRE_TOKEN=true でトークン未設定なら失敗する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, {
      cwd: tmp,
      unset: ["PUBLIC_CF_BEACON_TOKEN"],
      env: { BEACON_GATE_REQUIRE_TOKEN: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BEACON_GATE_REQUIRE_TOKEN/);
  });
});

test("BEACON_GATE_REQUIRE_TOKEN=true でトークンが空文字列なら失敗する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: { PUBLIC_CF_BEACON_TOKEN: "", BEACON_GATE_REQUIRE_TOKEN: "true" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BEACON_GATE_REQUIRE_TOKEN/);
  });
});

test("BEACON_GATE_REQUIRE_TOKEN=true でもトークン設定済みなら通常どおり検査する", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: {
        PUBLIC_CF_BEACON_TOKEN: "dummy",
        BEACON_GATE_REQUIRE_TOKEN: "true",
      },
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
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

test("script に data-cf-beacon が無ければ失敗する(#227)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG_NO_TOKEN);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: {
        PUBLIC_CF_BEACON_TOKEN: "dummy",
        BEACON_GATE_REQUIRE_TOKEN: "true",
      },
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /dummy/);
  });
});

test("data-cf-beacon の token が期待値と異なれば失敗する(#227)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG_WRONG_TOKEN);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: {
        PUBLIC_CF_BEACON_TOKEN: "dummy",
        BEACON_GATE_REQUIRE_TOKEN: "true",
      },
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /dummy/);
  });
});

test("data-cf-beacon の JSON が不正なら失敗する(#227)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG_INVALID_JSON);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: {
        PUBLIC_CF_BEACON_TOKEN: "dummy",
        BEACON_GATE_REQUIRE_TOKEN: "true",
      },
    });
    assert.equal(result.status, 1);
  });
});

test("HTML コメント内の URL だけでは成功しない(#227)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_URL_IN_COMMENT);
    const result = runScript(SCRIPT, {
      cwd: tmp,
      env: {
        PUBLIC_CF_BEACON_TOKEN: "dummy",
        BEACON_GATE_REQUIRE_TOKEN: "true",
      },
    });
    assert.equal(result.status, 1);
  });
});
