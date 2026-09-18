import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runScript, withTmpDir } from "./lib/spawn-script.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-hero-video.mjs"
);
const FULL_VIDEO_HTML = `
<video data-motion-optional>
  <source src="/hero-battle.webm" type="video/webm" />
  <source src="/hero-battle.mp4" type="video/mp4" />
</video>
<img src="/hero-poster.jpg" />
`;

function writeDistHtml(tmp, name, content) {
  const full = join(tmp, "dist", name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

test("dist/ に HTML が無ければ失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    mkdirSync(join(tmp, "dist"), { recursive: true });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm run build/);
  });
});

test("index.html が無ければ失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(tmp, "privacy/index.html", "<p>privacy</p>");
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dist\/index\.html が見つかりません/);
  });
});

test("静止画フォールバックになっていれば失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(tmp, "index.html", '<img src="/hero-poster.jpg" />');
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /静止画フォールバックで出力されています/);
  });
});

test("動画タグはあるが参照アセットが欠けていれば失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional><source src="/hero-battle.webm" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /参照先アセットの一部が見つかりません/);
  });
});

test("動画タグと必要アセットが揃っていれば成功する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(tmp, "index.html", FULL_VIDEO_HTML);
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});
