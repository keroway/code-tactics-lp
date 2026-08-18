import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

const BASE_URL =
  process.env.BASE_URL ?? "http://localhost:4321/code-tactics-lp/";

// ホームページ以外に /privacy・/404 も独自マークアップを持つ実ページなので
// 併せて検査する (#151)。404 ページは存在しないパスへのアクセスだと HTTP 404 応答になり
// Lighthouse (別ツール) 側が ERRORED_DOCUMENT_REQUEST で落ちるため、両ツールで挙動を
// 揃えるべく実ファイル 404.html への直接アクセス (200 応答) で検証する。
const PATHS = ["", "privacy/", "404.html"];

const browser = await chromium.launch();
const context = await browser.newContext();

let violationCount = 0;

try {
  for (const path of PATHS) {
    const url = new URL(path, BASE_URL).href;
    const page = await context.newPage();
    try {
      await page.goto(url);
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

  if (violationCount > 0) {
    process.exit(1);
  }
} finally {
  await browser.close();
}
