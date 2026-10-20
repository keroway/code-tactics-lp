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
// Astro の addAttribute(html-escaper の escape)が実際に出力する形式(#229)。
// `"` は `&quot;` にエスケープされ、属性値自体はダブルクォートで囲まれる。
const BEACON_TAG_ESCAPED_ATTR = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;:&quot;${EXPECTED_TOKEN}&quot;}"></script>`;

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

test("Astro が出力するエンティティエスケープ済み属性は正常判定される(#229)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(tmp, "index.html", BEACON_TAG_ESCAPED_ATTR);
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

test("src ではなく data-src だけなら失敗する(#267)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      `<script defer data-src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${EXPECTED_TOKEN}"}'></script>`
    );
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

const GATE_ENV = {
  PUBLIC_CF_BEACON_TOKEN: "dummy",
  BEACON_GATE_REQUIRE_TOKEN: "true",
};
const beaconTagWithType = (type) =>
  `<script defer ${type} src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${EXPECTED_TOKEN}"}'></script>`;

for (const type of [
  'type="application/json"',
  'type="text/plain"',
  "type=text/plain",
  "type='application/json'",
]) {
  test(`実行対象外の script ${type} なら失敗する(#297)`, async () => {
    await withTmpDir("check-beacon-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", beaconTagWithType(type));
      const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /type が実行対象外/);
    });
  });
}

for (const type of [
  'type="text/javascript"',
  'type="application/javascript"',
  'type="module"',
  'type=""',
]) {
  test(`実行対象の script ${type} は成功する(#297)`, async () => {
    await withTmpDir("check-beacon-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", beaconTagWithType(type));
      const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /OK/);
    });
  });
}

for (const [name, html] of [
  ["template 内", `<template>${BEACON_TAG}</template>`],
  [
    "text/plain script の本文内",
    `<script type="text/plain">${BEACON_TAG}</script>`,
  ],
  [
    "application/json script の本文内",
    `<script type="application/json">${BEACON_TAG}</script>`,
  ],
]) {
  test(`${name}の疑似ビーコンだけなら失敗する(#303)`, async () => {
    await withTmpDir("check-beacon-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", html);
      const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
      assert.equal(result.status, 1);
    });
  });
}

const BEACON_ATTRS = `src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${EXPECTED_TOKEN}"}'`;

for (const [name, html] of [
  [
    "他属性の値内の疑似 src",
    `<script defer title='x src="https://static.cloudflareinsights.com/beacon.min.js"' data-cf-beacon='{"token":"${EXPECTED_TOKEN}"}'></script>`,
  ],
  [
    "他属性の値内の疑似 data-cf-beacon",
    `<script defer title='x data-cf-beacon="{&quot;token&quot;:&quot;${EXPECTED_TOKEN}&quot;}"' src="https://static.cloudflareinsights.com/beacon.min.js"></script>`,
  ],
  [
    "他属性の値内の疑似 type があっても実 type が実行対象外の script",
    `<script defer title='type="module"' type="text/plain" ${BEACON_ATTRS}></script>`,
  ],
  [
    "重複 src の後続側",
    `<script defer src="/other.js" ${BEACON_ATTRS}></script>`,
  ],
]) {
  test(`${name}では成功しない(#320)`, async () => {
    await withTmpDir("check-beacon-gate-", async (tmp) => {
      writeDistHtml(tmp, "index.html", html);
      const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
      assert.equal(result.status, 1);
    });
  });
}

test("引用符内の > を含む正常なビーコンタグは成功する(#320)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      `<script defer title=">" ${BEACON_ATTRS}></script>`
    );
    const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});

test("別要素の属性値内の疑似ビーコンだけなら失敗する(#322)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      `<div title="${BEACON_TAG.replaceAll('"', "&quot;")}">text</div><div title='${BEACON_TAG.replaceAll("'", "&#39;")}'>text</div>`
    );
    const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
    assert.equal(result.status, 1);
  });
});

test("別要素の属性値内に疑似タグがあっても後ろの実ビーコンは数える(#322)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      `<div title="<script src=x>">text</div>${BEACON_TAG}`
    );
    const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});

test("不活性領域の後ろに実ビーコンがあれば成功する(#303)", async () => {
  await withTmpDir("check-beacon-gate-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      `<template>${BEACON_TAG_NO_TOKEN}</template><script type="text/plain">${BEACON_TAG_NO_TOKEN}</script>${BEACON_TAG}`
    );
    const result = runScript(SCRIPT, { cwd: tmp, env: GATE_ENV });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
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
