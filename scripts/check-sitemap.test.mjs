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

test("sitemap-0.xml のルート属性が重複していれば失敗する（#378）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        "<urlset ",
        '<urlset broken="1" broken="2" '
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*重複/);
  });
});

test("sitemap-0.xml に未定義の実体参照があれば失敗する（#378）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc>`,
        `<url><loc>${SITE_URL}/</loc><lastmod>&undefined;</lastmod>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*実体参照/);
  });
});

test("定義済み実体・文字参照は許容する（#378）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc>`,
        `<url><loc>${SITE_URL}/</loc><lastmod>a&amp;b&#38;&#x26;&lt;</lastmod>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
  });
});

for (const [label, attr] of [
  ["引用符なし属性", "broken=1"],
  ["値のない属性", "broken"],
  ["属性値内の小なり記号", 'broken="a<b"'],
]) {
  test(`sitemap-0.xml のルートに${label}があれば失敗する（#381）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        sitemapXml: VALID_SITEMAP_XML.replace("<urlset ", `<urlset ${attr} `),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /正しい XML ではありません.*属性/);
    });
  });
}

test("属性間に空白がなければ失敗する（#381）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '<urlset a="1"xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
  });
});

test("引用符付き属性と = 前後の空白は許容する（#381）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        "<urlset ",
        "<urlset a = '1' xmlns:xsi=\"x\" "
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0);
  });
});

for (const [label, tail] of [
  ["名前の後ろの文字列", "</urlset broken>"],
  ["自己終了スラッシュ", "</urlset/>"],
]) {
  test(`sitemap-0.xml のルート終了タグに${label}があれば失敗する（#383）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        sitemapXml: VALID_SITEMAP_XML.replace("</urlset>", tail),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /sitemap-0\.xml が正しい XML ではありません.*閉じタグ/
      );
    });
  });

  test(`sitemap-index.xml のルート終了タグに${label}があれば失敗する（#383）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        indexXml: VALID_INDEX_XML.replace(
          "</sitemapindex>",
          tail.replace("urlset", "sitemapindex")
        ),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /sitemap-index\.xml が正しい XML ではありません.*閉じタグ/
      );
    });
  });
}

test("終了タグの末尾空白は許容する（#383）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace("</urlset>", "</urlset \n>"),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

for (const ref of ["&#0;", "&#x110000;", "&#xD800;", "&#xFFFE;"]) {
  test(`XML の Char 範囲外の文字参照 ${ref} は失敗する（#385）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        sitemapXml: VALID_SITEMAP_XML.replace(
          `<url><loc>${SITE_URL}/</loc>`,
          `<url><loc>${SITE_URL}/</loc><lastmod>${ref}</lastmod>`
        ),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /正しい XML ではありません.*実体参照/);
    });
  });
}

test("不正な属性名は失敗する（#385）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        "<urlset ",
        '<urlset bad?name="x" '
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*属性/);
  });
});

test("ルート開始タグの前の CDATA は失敗する（#385）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `<![CDATA[garbage]]>${VALID_SITEMAP_XML}`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません/);
  });
});

test("ルート終了タグの後ろの CDATA は失敗する（#385）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: `${VALID_SITEMAP_XML}<![CDATA[garbage]]>`,
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません/);
  });
});

test("有効な文字参照・要素内 CDATA は許容する（#385）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        `<url><loc>${SITE_URL}/</loc>`,
        `<url><loc>${SITE_URL}/</loc><lastmod>&#9;&#xA;&#x10FFFF;<![CDATA[ok]]></lastmod>`
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

function withLastmod(body) {
  return VALID_SITEMAP_XML.replace(
    `<url><loc>${SITE_URL}/</loc>`,
    `<url><loc>${SITE_URL}/</loc><lastmod>${body}</lastmod>`
  );
}

test("生の NUL 文字を含む sitemap は失敗する（#393）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { sitemapXml: withLastmod("\u0000") });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*U\+0000/);
  });
});

test("CDATA 外の ]]> を含む sitemap は失敗する（#393）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, { sitemapXml: withLastmod("]]>") });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*\]\]>/);
  });
});

test("空白・通常テキスト・CDATA 内の ]] は許容する（#393）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: withLastmod("\t\r\n text <![CDATA[a]]b]]>"),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

for (const [label, comment] of [
  ["コメント内の --", "<!-- bad -- comment -->"],
  ["--> 直前の -", "<!-- bad --->"],
]) {
  test(`不正なコメント（${label}）は失敗する（#403）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        indexXml: VALID_INDEX_XML.replace(
          "<sitemapindex",
          `${comment}<sitemapindex`
        ),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /正しい XML ではありません.*コメント/);
    });
  });
}

for (const [label, pi] of [
  ["空", "<??>"],
  ["target が数字始まり", "<?1a x?>"],
  ["文書先頭以外の xml 宣言", '<?xml version="1.0"?>'],
]) {
  test(`不正な処理命令（${label}）は失敗する（#403）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        indexXml: VALID_INDEX_XML.replace(
          "<sitemapindex",
          `${pi}<sitemapindex`
        ),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /正しい XML ではありません.*処理命令/);
    });
  });
}

test("未宣言の namespace 接頭辞を持つ属性は失敗する（#403）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: VALID_INDEX_XML.replace(
        "<sitemapindex ",
        '<sitemapindex missing:attr="value" '
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*missing:attr/);
  });
});

test("未宣言の namespace 接頭辞を持つ要素は失敗する（#403）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: withLastmod("x").replace(
        "<lastmod>x</lastmod>",
        "<foo:lastmod>x</foo:lastmod>"
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /正しい XML ではありません.*foo:lastmod/);
  });
});

test("宣言済みの接頭辞・xml: 接頭辞・通常のコメントと処理命令は許容する（#403）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      indexXml: VALID_INDEX_XML.replace(
        "<sitemapindex ",
        '<!-- ok - comment --><?pi data?><sitemapindex xmlns:x="urn:x" x:a="1" xml:lang="ja" '
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
  });
});

for (const [label, extra, pattern] of [
  ["xml 接頭辞の再束縛", 'xmlns:xml="urn:wrong"', /予約接頭辞 xml/],
  ["xmlns 接頭辞の宣言", 'xmlns:xmlns="urn:wrong"', /予約接頭辞 xmlns/],
  [
    "xml namespace の他接頭辞への束縛",
    'xmlns:a="http://www.w3.org/XML/1998/namespace"',
    /接頭辞 xml 以外/,
  ],
  [
    "展開名が同じ属性の重複",
    'xmlns:a="urn:same" xmlns:b="urn:same" a:id="1" b:id="2"',
    /展開名が同じ属性/,
  ],
]) {
  test(`${label}は失敗する（#408）`, async () => {
    await withTmpDir("check-sitemap-", async (tmp) => {
      setupFixture(tmp, {
        sitemapXml: VALID_SITEMAP_XML.replace("<urlset ", `<urlset ${extra} `),
      });
      const result = runScript(SCRIPT, { cwd: tmp });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /正しい XML ではありません/);
      assert.match(result.stderr, pattern);
    });
  });
}

test("異なる namespace の同名属性・xml 接頭辞の正規束縛は許容する（#408）", async () => {
  await withTmpDir("check-sitemap-", async (tmp) => {
    setupFixture(tmp, {
      sitemapXml: VALID_SITEMAP_XML.replace(
        "<urlset ",
        '<urlset xmlns:xml="http://www.w3.org/XML/1998/namespace" xmlns:a="urn:a" xmlns:b="urn:b" a:id="1" b:id="2" id="3" '
      ),
    });
    const result = runScript(SCRIPT, { cwd: tmp });
    assert.equal(result.status, 0, result.stderr);
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
