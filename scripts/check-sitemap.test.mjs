import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runScript, withTmpDir } from "./lib/spawn-script.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-sitemap.mjs"
);
const SITE_URL = "https://keroway.github.io/code-tactics-lp";

const VALID_INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${SITE_URL}/sitemap-0.xml</loc></sitemap>
</sitemapindex>`;

const VALID_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
<url><loc>${SITE_URL}/privacy/</loc></url>
</urlset>`;

const VALID_ROBOTS_TXT = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap-index.xml
`;

function setupFixture(tmp, overrides = {}) {
  mkdirSync(join(tmp, "dist"), { recursive: true });
  mkdirSync(join(tmp, "public"), { recursive: true });
  const {
    indexXml = VALID_INDEX_XML,
    sitemapXml = VALID_SITEMAP_XML,
    robotsTxt = VALID_ROBOTS_TXT,
    distRobotsTxt = VALID_ROBOTS_TXT,
    skipIndexXml = false,
    skipSitemapXml = false,
    skipRobotsTxt = false,
    skipDistRobotsTxt = false,
  } = overrides;
  if (!skipIndexXml) {
    writeFileSync(join(tmp, "dist", "sitemap-index.xml"), indexXml);
  }
  if (!skipSitemapXml) {
    writeFileSync(join(tmp, "dist", "sitemap-0.xml"), sitemapXml);
  }
  if (!skipRobotsTxt) {
    writeFileSync(join(tmp, "public", "robots.txt"), robotsTxt);
  }
  if (!skipDistRobotsTxt) {
    writeFileSync(join(tmp, "dist", "robots.txt"), distRobotsTxt);
  }
}

test("sitemap-index.xml が無ければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { skipIndexXml: true });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sitemap-index\.xml が見つかりません/);
  });
});

test("sitemap-0.xml が無ければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { skipSitemapXml: true });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sitemap-0\.xml が見つかりません/);
  });
});

test("robots.txt が無ければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { skipRobotsTxt: true });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /public\/robots\.txt が見つかりません/);
  });
});

test("sitemap-index.xml の参照先が想定と違えば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${SITE_URL}/wrong.xml</loc></sitemap>
</sitemapindex>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /参照する URL が想定と異なります/);
  });
});

test("sitemap-0.xml の収録URLが不足していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /不足: /);
  });
});

test("sitemap-0.xml に想定外URLが混ざっていれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
<url><loc>${SITE_URL}/privacy/</loc></url>
<url><loc>${SITE_URL}/extra/</loc></url>
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /想定外: /);
  });
});

test("期待URLがすべて XML コメント内にあれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<!-- <url><loc>${SITE_URL}/</loc></url>
<url><loc>${SITE_URL}/privacy/</loc></url> -->
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /不足: /);
  });
});

test("想定外URLが XML コメント内にあるだけなら成功する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
<url><loc>${SITE_URL}/privacy/</loc></url>
<!-- <url><loc>${SITE_URL}/extra/</loc></url> -->
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
  });
});

test("url 要素の外にある loc は収録URLとして数えない", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
<loc>${SITE_URL}/privacy/</loc>
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /不足: /);
  });
});

test("sitemap-index.xml の参照先が XML コメント内だけなら失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<!-- <sitemap><loc>${SITE_URL}/sitemap-0.xml</loc></sitemap> -->
</sitemapindex>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /参照する URL が想定と異なります/);
  });
});

test("sitemap-0.xml の閉じタグ </urlset> が欠落していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace("</urlset>", ""),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sitemap-0\.xml が正しい XML ではありません/);
  });
});

test("sitemap-0.xml のルート終了タグの後ろに文字列があれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { sitemapXml: `${VALID_SITEMAP_XML}BROKEN` });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sitemap-0\.xml が正しい XML ではありません/);
  });
});

test("sitemap-index.xml のルート開始タグの前に文字列があれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: `BROKEN${VALID_INDEX_XML.replace(/^<\?xml[^>]*\?>\n/, "")}`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /sitemap-index\.xml が正しい XML ではありません/
    );
  });
});

test("ルート要素の前後が空白だけなら成功する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { sitemapXml: `\n  ${VALID_SITEMAP_XML}\n\n` });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

test("sitemap-index.xml の閉じタグが欠落していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: VALID_INDEX_XML.replace("</sitemapindex>", ""),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /sitemap-index\.xml が正しい XML ではありません/
    );
  });
});

test("sitemap-0.xml のタグ対応が崩れていれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc></url>`,
        `<url><loc>${SITE_URL}/</url></loc>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません/);
  });
});

test("sitemap-index.xml のルート名が sitemapindex でなければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: VALID_INDEX_XML.replaceAll("sitemapindex", "wrong"),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /sitemap-index\.xml が正しい sitemap ではありません/
    );
  });
});

test("sitemap-0.xml のルート名が urlset でなければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replaceAll("urlset", "wrong"),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /sitemap-0\.xml が正しい sitemap ではありません/
    );
  });
});

test("sitemap-0.xml の namespace が標準でなければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        "http://www.sitemaps.org/schemas/sitemap/0.9",
        "http://example.com/ns"
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /namespace/);
  });
});

test("url 要素で namespace を変更していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc>`,
        `<url xmlns="urn:wrong"><loc>${SITE_URL}/</loc>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /namespace/);
  });
});

test("url 要素で namespace を解除していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/privacy/</loc>`,
        `<url xmlns=""><loc>${SITE_URL}/privacy/</loc>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /namespace/);
  });
});

test("loc 要素で namespace を変更していれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: VALID_INDEX_XML.replace("<loc>", '<loc xmlns="urn:wrong">'),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /namespace/);
  });
});

test("子要素で標準 namespace を再宣言しても成功する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc>`,
        `<url xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><loc>${SITE_URL}/</loc>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

test("収録URLがすべて CDATA 内にあれば失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<![CDATA[<url><loc>${SITE_URL}/</loc></url>
<url><loc>${SITE_URL}/privacy/</loc></url>]]>
</urlset>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /不足: /);
  });
});

test("sitemap-index.xml の参照先が CDATA 内だけなら失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<![CDATA[<sitemap><loc>${SITE_URL}/sitemap-0.xml</loc></sitemap>]]>
</sitemapindex>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /参照する URL が想定と異なります/);
  });
});

test("robots.txt の Sitemap: 行が一致しなければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      robotsTxt: `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/wrong-index.xml\n`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Sitemap: 行が sitemap-index\.xml の URL と一致しません/
    );
  });
});

test("dist/robots.txt が無ければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { skipDistRobotsTxt: true });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dist\/robots\.txt が見つかりません/);
  });
});

test("dist/robots.txt の Sitemap: 行が一致しなければ失敗する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      distRobotsTxt: `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/wrong-index.xml\n`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /dist\/robots\.txt の Sitemap: 行が sitemap-index\.xml の URL と一致しません/
    );
  });
});

test("すべて整合していれば成功する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp);
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});
