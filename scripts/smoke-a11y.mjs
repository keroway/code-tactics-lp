import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE_URL =
  process.env.BASE_URL ?? "http://localhost:4321/code-tactics-lp/";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(BASE_URL);
  const results = await new AxeBuilder({ page }).analyze();

  if (results.violations.length > 0) {
    console.error(
      `axe-core: ${results.violations.length} violation(s) found\n`,
    );
    for (const v of results.violations) {
      console.error(`[${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes) {
        console.error(`  - ${node.target.join(", ")}`);
        if (node.failureSummary) {
          console.error(`    ${node.failureSummary.replace(/\n/g, "\n    ")}`);
        }
      }
    }
    process.exit(1);
  }

  console.log(
    `axe-core: no violations found (${results.passes.length} rules passed)`,
  );
} finally {
  await browser.close();
}
