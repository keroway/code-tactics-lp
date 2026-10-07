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
<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg">
  <source src="/code-tactics-lp/hero-battle.webm" type="video/webm" />
  <source src="/code-tactics-lp/hero-battle.mp4" type="video/mp4" />
</video>
`;

function writeDistHtml(tmp, name, content) {
  const full = join(tmp, "dist", name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

const HERO_ASSETS = ["hero-poster.jpg", "hero-battle.webm", "hero-battle.mp4"];

function writeHeroAssets(tmp, names = HERO_ASSETS, content = "x") {
  for (const name of names) writeDistHtml(tmp, name, content);
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
    writeDistHtml(
      tmp,
      "index.html",
      '<img src="/code-tactics-lp/hero-poster.jpg" />'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /静止画フォールバックで出力されています/);
  });
});

test("動画タグはあるが poster 属性が欠けていれば失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional><source src="/code-tactics-lp/hero-battle.webm" /><source src="/code-tactics-lp/hero-battle.mp4" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /poster 属性に hero-poster\.jpg が指定されていません/
    );
  });
});

test("動画タグはあるが参照アセットが欠けていれば失敗する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg"><source src="/code-tactics-lp/hero-battle.webm" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /source の src に hero-battle\.mp4 がありません/
    );
  });
});

test("video 要素がコメントアウトされ本文にアセット名があるだけなら失敗する（#235）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<!-- <video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg"><source src="/code-tactics-lp/hero-battle.webm" /><source src="/code-tactics-lp/hero-battle.mp4" /></video> --><img src="/screenshot.png" />'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /静止画フォールバックで出力されています/);
  });
});

test("video タグはあるがアセット名が本文テキストにあるだけなら失敗する（#235）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      "<video data-motion-optional></video><p>hero-battle.webm hero-battle.mp4 hero-poster.jpg</p>"
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /poster 属性に hero-poster\.jpg が指定されていません/
    );
  });
});

test("data-poster だけで poster 属性が無ければ失敗する（#267）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional data-poster="/code-tactics-lp/hero-poster.jpg"><source src="/code-tactics-lp/hero-battle.webm" /><source src="/code-tactics-lp/hero-battle.mp4" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /poster 属性に hero-poster\.jpg が指定されていません/
    );
  });
});

test("data-src だけで src 属性が無ければ失敗する（#267）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg"><source data-src="/code-tactics-lp/hero-battle.webm" /><source data-src="/code-tactics-lp/hero-battle.mp4" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source の src に hero-battle\.webm/);
  });
});

test("poster が別ファイル名(末尾に文字列付き)なら失敗する（#269）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg.missing"><source src="/code-tactics-lp/hero-battle.webm" /><source src="/code-tactics-lp/hero-battle.mp4" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /poster 属性に hero-poster\.jpg が指定されていません/
    );
  });
});

test("source が別ファイル名(末尾に文字列付き)なら失敗する（#269）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg"><source src="/code-tactics-lp/hero-battle.webm.missing" /><source src="/code-tactics-lp/hero-battle.mp4.missing" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /source の src に hero-battle\.webm, hero-battle\.mp4 がありません/
    );
  });
});

test("base パス前置とクエリ付きの参照は成功する（#269）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg?v=1"><source src="/code-tactics-lp/hero-battle.webm" /><source src="/code-tactics-lp/hero-battle.mp4#t=0" /></video>'
    );
    writeHeroAssets(tmp);
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
  });
});

for (const [label, prefix] of [
  ["base が欠落している", ""],
  ["誤ったディレクトリ配下である", "/wrong-directory"],
  ["別 origin を指している", "https://cdn.example.com/code-tactics-lp"],
]) {
  test(`参照パスが ${label}なら失敗する（#273）`, async () => {
    await withTmpDir("check-hero-video-", async (tmp) => {
      writeDistHtml(
        tmp,
        "index.html",
        `<video data-motion-optional poster="${prefix}/hero-poster.jpg"><source src="${prefix}/hero-battle.webm" /><source src="${prefix}/hero-battle.mp4" /></video>`
      );
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /poster 属性に hero-poster\.jpg が指定されていません/
      );
    });
  });
}

test("poster だけ base が正しく source の base が欠落していれば失敗する（#273）", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(
      tmp,
      "index.html",
      '<video data-motion-optional poster="/code-tactics-lp/hero-poster.jpg"><source src="/hero-battle.webm" /><source src="/hero-battle.mp4" /></video>'
    );
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /source の src に hero-battle\.webm, hero-battle\.mp4 がありません/
    );
  });
});

test("動画タグと必要アセットが揃っていれば成功する", async () => {
  await withTmpDir("check-hero-video-", async (tmp) => {
    writeDistHtml(tmp, "index.html", FULL_VIDEO_HTML);
    writeHeroAssets(tmp);
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});

for (const name of HERO_ASSETS) {
  test(`dist/${name} の実体が無ければ失敗する（#280）`, async () => {
    await withTmpDir("check-hero-video-", async (tmp) => {
      writeDistHtml(tmp, "index.html", FULL_VIDEO_HTML);
      writeHeroAssets(
        tmp,
        HERO_ASSETS.filter((n) => n !== name)
      );
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`dist/${name} が存在しません`));
    });
  });

  test(`dist/${name} が空ファイルなら失敗する（#280）`, async () => {
    await withTmpDir("check-hero-video-", async (tmp) => {
      writeDistHtml(tmp, "index.html", FULL_VIDEO_HTML);
      writeHeroAssets(tmp);
      writeDistHtml(tmp, name, "");
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`dist/${name} が空ファイルです`));
    });
  });
}
