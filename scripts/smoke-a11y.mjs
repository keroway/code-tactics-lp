import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { verifyPage } from "./lib/verify-page.mjs";

const BASE_URL =
  process.env.BASE_URL ?? "http://localhost:4321/code-tactics-lp/";

// ホームページ以外に /privacy・/404 も独自マークアップを持つ実ページなので
// 併せて検査する (#151)。404 ページは存在しないパスへのアクセスだと HTTP 404 応答になり
// Lighthouse (別ツール) 側が ERRORED_DOCUMENT_REQUEST で落ちるため、両ツールで挙動を
// 揃えるべく実ファイル 404.html への直接アクセス (200 応答) で検証する。
const PATHS = [
  { path: "", titleIncludes: "code-tactics —" },
  { path: "privacy/", titleIncludes: "プライバシー" },
  { path: "404.html", titleIncludes: "404" },
];

// axe の前に、HTTP 200・最終 URL・タイトルで「狙ったページに着いたか」を確認する (#275)。
async function gotoAndVerify(page, url, titleIncludes) {
  const response = await page.goto(url);
  const problems = verifyPage(
    {
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title: await page.title(),
    },
    { url, titleIncludes }
  );
  if (problems.length > 0) {
    throw new Error(`unexpected page (${url}): ${problems.join("; ")}`);
  }
}

// FAQ (details/summary) の展開・折り畳みと、展開状態での axe を検査する (#291)。
// ポインター (click) とキーボード (Enter / Space) の両方で summary を操作する。
async function checkFaq(browserContext, label) {
  const url = new URL("", BASE_URL).href;
  const page = await browserContext.newPage();
  let violations = 0;
  try {
    await gotoAndVerify(page, url, PATHS[0].titleIncludes);
    await page.locator("#faq").scrollIntoViewIfNeeded();
    // data-animate のフェードインが終わるまで待ってから検査する。
    await page.waitForFunction(
      () => {
        const faq = document.getElementById("faq");
        return faq && getComputedStyle(faq).opacity === "1";
      },
      undefined,
      { timeout: 5000 }
    );

    const items = page.locator("#faq details");
    const count = await items.count();
    if (count === 0) {
      throw new Error(`FAQ (${label}): no details elements found`);
    }

    const operations = [
      {
        name: "click",
        run: (summary) => summary.click(),
      },
      {
        name: "Enter",
        run: async (summary) => {
          await summary.focus();
          await page.keyboard.press("Enter");
        },
      },
      {
        name: "Space",
        run: async (summary) => {
          await summary.focus();
          await page.keyboard.press("Space");
        },
      },
    ];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const summary = item.locator("summary");
      const answer = item.locator("p");
      const op = operations[i % operations.length];

      if (await item.evaluate((el) => el.open)) {
        throw new Error(`FAQ (${label}) #${i + 1}: open before interaction`);
      }
      if (await answer.isVisible()) {
        throw new Error(
          `FAQ (${label}) #${i + 1}: answer visible while collapsed`
        );
      }

      await op.run(summary);
      if (!(await item.evaluate((el) => el.open))) {
        throw new Error(`FAQ (${label}) #${i + 1}: did not open by ${op.name}`);
      }
      if (!(await answer.isVisible())) {
        throw new Error(
          `FAQ (${label}) #${i + 1}: answer not visible after ${op.name}`
        );
      }
      if (((await answer.innerText()) ?? "").trim() === "") {
        throw new Error(`FAQ (${label}) #${i + 1}: answer text is empty`);
      }

      await op.run(summary);
      if (await item.evaluate((el) => el.open)) {
        throw new Error(
          `FAQ (${label}) #${i + 1}: did not close by ${op.name}`
        );
      }
      if (await answer.isVisible()) {
        throw new Error(
          `FAQ (${label}) #${i + 1}: answer still visible after collapse`
        );
      }
    }
    console.log(
      `faq (${label}): ${count} items open/close by click, Enter, Space`
    );

    // すべて展開した状態で axe を実行する (回答本文の配色・マークアップ)。
    for (let i = 0; i < count; i++) {
      await items.nth(i).locator("summary").click();
    }
    // 展開でレイアウトが伸び、下のセクションがビューポートに入ってフェードインを
    // 始める。遷移の途中色を axe が拾って誤検知するため、IntersectionObserver の
    // 反応と有限アニメーション/遷移の完了を待ってから検査する。
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect?.getComputedTiming().iterations !==
              Number.POSITIVE_INFINITY
          )
          .map((a) => a.finished.catch(() => undefined))
      )
    );
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      violations += results.violations.length;
      console.error(
        `axe-core (FAQ expanded, ${label}, ${url}): ${results.violations.length} violation(s) found\n`
      );
      for (const v of results.violations) {
        console.error(`[${v.impact}] ${v.id}: ${v.description}`);
        for (const node of v.nodes) {
          console.error(`  - ${node.target.join(", ")}`);
          if (node.failureSummary) {
            console.error(
              `    ${node.failureSummary.replace(/\n/g, "\n    ")}`
            );
          }
        }
      }
    } else {
      console.log(
        `axe-core (FAQ expanded, ${label}, ${url}): no violations found (${results.passes.length} rules passed)`
      );
    }
  } finally {
    await page.close();
  }
  return violations;
}

// 全セクション (data-animate) と stagger の子要素を表示完了にしてから axe を実行する (#299)。
// 通常検査は遷移直後に走るため、フェード前 (opacity 0) の本文は検査から外れうる。
// 全要素が opacity 1 になったことを確認した上で検査する。reduced-motion 側では
// フェード自体が無効で、最初から表示されていることを検査する。
async function checkAllSectionsVisible(browserContext, label) {
  const url = new URL("", BASE_URL).href;
  const page = await browserContext.newPage();
  let violations = 0;
  try {
    await gotoAndVerify(page, url, PATHS[0].titleIncludes);
    const sections = page.locator("[data-animate]");
    const sectionCount = await sections.count();
    if (sectionCount === 0) {
      throw new Error(`all sections (${label}): no [data-animate] elements`);
    }
    for (let i = 0; i < sectionCount; i++) {
      await sections.nth(i).scrollIntoViewIfNeeded();
    }
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll("[data-animate], [data-stagger] > *"),
        ].every((el) => getComputedStyle(el).opacity === "1"),
      undefined,
      { timeout: 10000 }
    );
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect?.getComputedTiming().iterations !==
              Number.POSITIVE_INFINITY
          )
          .map((a) => a.finished.catch(() => undefined))
      )
    );
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      violations += results.violations.length;
      console.error(
        `axe-core (all sections visible, ${label}, ${url}): ${results.violations.length} violation(s) found\n`
      );
      for (const v of results.violations) {
        console.error(`[${v.impact}] ${v.id}: ${v.description}`);
        for (const node of v.nodes) {
          console.error(`  - ${node.target.join(", ")}`);
          if (node.failureSummary) {
            console.error(
              `    ${node.failureSummary.replace(/\n/g, "\n    ")}`
            );
          }
        }
      }
    } else {
      console.log(
        `axe-core (all sections visible, ${label}, ${url}): no violations found (${results.passes.length} rules passed; ${sectionCount} sections)`
      );
    }
  } finally {
    await page.close();
  }
  return violations;
}

const browser = await chromium.launch();
const context = await browser.newContext();

let violationCount = 0;

try {
  for (const { path, titleIncludes } of PATHS) {
    const url = new URL(path, BASE_URL).href;
    const page = await context.newPage();
    try {
      await gotoAndVerify(page, url, titleIncludes);
      const results = await new AxeBuilder({ page }).analyze();

      if (results.violations.length > 0) {
        violationCount += results.violations.length;
        console.error(
          `axe-core (${url}): ${results.violations.length} violation(s) found\n`
        );
        for (const v of results.violations) {
          console.error(`[${v.impact}] ${v.id}: ${v.description}`);
          for (const node of v.nodes) {
            console.error(`  - ${node.target.join(", ")}`);
            if (node.failureSummary) {
              console.error(
                `    ${node.failureSummary.replace(/\n/g, "\n    ")}`
              );
            }
          }
        }
      } else {
        console.log(
          `axe-core (${url}): no violations found (${results.passes.length} rules passed)`
        );
      }
    } finally {
      await page.close();
    }
  }

  violationCount += await checkFaq(context, "desktop");
  const faqMobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  try {
    violationCount += await checkFaq(faqMobileContext, "mobile");
  } finally {
    await faqMobileContext.close();
  }

  violationCount += await checkAllSectionsVisible(context, "motion");
  const reducedContext = await browser.newContext({
    reducedMotion: "reduce",
  });
  try {
    violationCount += await checkAllSectionsVisible(
      reducedContext,
      "reduced-motion"
    );
  } finally {
    await reducedContext.close();
  }

  // Mobile viewport pass: verify the hamburger menu opens and is axe-clean (#004).
  const mobileUrl = new URL("", BASE_URL).href;
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  const mobilePage = await mobileContext.newPage();
  try {
    await gotoAndVerify(mobilePage, mobileUrl, PATHS[0].titleIncludes);
    await mobilePage.click("#menu-toggle");

    const expanded = await mobilePage.getAttribute(
      "#menu-toggle",
      "aria-expanded"
    );
    if (expanded !== "true") {
      throw new Error("mobile menu did not open (aria-expanded != true)");
    }
    const menuVisible = await mobilePage.isVisible("#mobile-menu");
    if (!menuVisible) {
      throw new Error("mobile menu not visible after click");
    }

    // All links must fit inside the panel once the open transition settles (#278).
    await mobilePage.waitForFunction(
      () => {
        const menu = document.getElementById("mobile-menu");
        return menu && menu.scrollHeight <= menu.clientHeight + 1;
      },
      undefined,
      { timeout: 3000 }
    );
    console.log("mobile menu: all links fit inside the panel");

    await mobilePage.keyboard.press("Tab");

    const results = await new AxeBuilder({ page: mobilePage }).analyze();
    if (results.violations.length > 0) {
      violationCount += results.violations.length;
      console.error(
        `axe-core (mobile menu, ${mobileUrl}): ${results.violations.length} violation(s) found\n`
      );
      for (const v of results.violations) {
        console.error(`[${v.impact}] ${v.id}: ${v.description}`);
        for (const node of v.nodes) {
          console.error(`  - ${node.target.join(", ")}`);
          if (node.failureSummary) {
            console.error(
              `    ${node.failureSummary.replace(/\n/g, "\n    ")}`
            );
          }
        }
      }
    } else {
      console.log(
        `axe-core (mobile menu, ${mobileUrl}): no violations found (${results.passes.length} rules passed)`
      );
    }

    // Escape closes the menu and returns focus to the toggle (#192).
    await mobilePage.keyboard.press("Escape");
    const expandedAfterEscape = await mobilePage.getAttribute(
      "#menu-toggle",
      "aria-expanded"
    );
    if (expandedAfterEscape !== "false") {
      throw new Error("Escape did not close the mobile menu");
    }
    if (await mobilePage.isVisible("#mobile-menu")) {
      throw new Error("mobile menu still visible after Escape");
    }
    const activeAfterEscape = await mobilePage.evaluate(
      () => document.activeElement?.id
    );
    if (activeAfterEscape !== "menu-toggle") {
      throw new Error(
        `focus did not return to #menu-toggle after Escape (got #${activeAfterEscape})`
      );
    }
    console.log("keyboard (mobile menu): Escape closes and restores focus");

    // Focus trap: Tab from the last item wraps to the toggle, and
    // Shift+Tab from the toggle wraps to the last item (#192).
    await mobilePage.click("#menu-toggle");
    await mobilePage.evaluate(() => {
      const items = document.querySelectorAll(
        "#mobile-menu a[href], #mobile-menu button:not([disabled])"
      );
      items[items.length - 1]?.focus();
    });
    await mobilePage.keyboard.press("Tab");
    const activeAfterForwardWrap = await mobilePage.evaluate(
      () => document.activeElement?.id
    );
    if (activeAfterForwardWrap !== "menu-toggle") {
      throw new Error(
        `Tab from last item did not wrap to #menu-toggle (got #${activeAfterForwardWrap})`
      );
    }

    await mobilePage.keyboard.press("Shift+Tab");
    const activeAfterBackwardWrap = await mobilePage.evaluate(() => {
      const items = document.querySelectorAll(
        "#mobile-menu a[href], #mobile-menu button:not([disabled])"
      );
      return document.activeElement === items[items.length - 1];
    });
    if (!activeAfterBackwardWrap) {
      throw new Error(
        "Shift+Tab from #menu-toggle did not wrap to the last focusable item"
      );
    }
    console.log("keyboard (mobile menu): Tab focus trap wraps both ways");

    // Resizing past the sm breakpoint (40rem) closes the still-open menu (#192).
    await mobilePage.setViewportSize({ width: 700, height: 667 });
    await mobilePage.waitForFunction(() => {
      const expanded = document
        .getElementById("menu-toggle")
        ?.getAttribute("aria-expanded");
      return expanded === "false";
    });
    if (await mobilePage.isVisible("#mobile-menu")) {
      throw new Error("mobile menu still visible after resizing past sm");
    }
    console.log(
      "keyboard (mobile menu): resize past sm breakpoint closes menu"
    );

    // Focus must not be stranded on the now-hidden menu/toggle (#283).
    const focusAfterResize = await mobilePage.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { ok: false, id: "body" };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !el.closest("[hidden]");
      return { ok: visible, id: el.id || el.tagName };
    });
    if (!focusAfterResize.ok) {
      throw new Error(
        `focus not on a visible element after resizing past sm (got ${focusAfterResize.id})`
      );
    }
    console.log(
      "keyboard (mobile menu): resize moves focus to a visible element"
    );

    // Selecting an in-page anchor closes the menu and navigates (#287).
    // Covers both pointer (click) and keyboard (Enter) activation.
    await mobilePage.setViewportSize({ width: 375, height: 667 });
    const selectionCases = [
      { name: "click", index: 1, activate: (link) => link.click() },
      {
        name: "Enter",
        index: 2,
        activate: async (link) => {
          await link.focus();
          await mobilePage.keyboard.press("Enter");
        },
      },
    ];
    for (const { name, index, activate } of selectionCases) {
      await mobilePage.click("#menu-toggle");
      await mobilePage.waitForSelector("#mobile-menu", { state: "visible" });
      const link = mobilePage.locator("#mobile-menu a[href]").nth(index);
      const href = await link.getAttribute("href");
      await activate(link);

      await mobilePage.waitForFunction((h) => location.hash === h, href, {
        timeout: 3000,
      });
      const expandedAfterSelect = await mobilePage.getAttribute(
        "#menu-toggle",
        "aria-expanded"
      );
      if (expandedAfterSelect !== "false") {
        throw new Error(
          `anchor selection (${name}) did not close the mobile menu`
        );
      }
      if (await mobilePage.isVisible("#mobile-menu")) {
        throw new Error(
          `mobile menu still visible after anchor selection (${name})`
        );
      }
      const focusAfterSelect = await mobilePage.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { ok: false, id: "body" };
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !el.closest("[hidden]");
        return { ok: visible, id: el.id || el.tagName };
      });
      if (!focusAfterSelect.ok) {
        throw new Error(
          `focus not on a visible element after anchor selection (${name}; got ${focusAfterSelect.id})`
        );
      }
      console.log(
        `keyboard (mobile menu): anchor selection by ${name} closes menu and navigates to ${href}`
      );
    }
  } finally {
    await mobilePage.close();
    await mobileContext.close();
  }

  if (violationCount > 0) {
    process.exit(1);
  }
} finally {
  await browser.close();
}
