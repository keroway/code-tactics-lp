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
    skipIndexXml = false,
    skipSitemapXml = false,
    skipRobotsTxt = false,
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

test("すべて整合していれば成功する", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp);
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK/);
  });
});
