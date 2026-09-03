# Plan 004: Cover the mobile menu interaction in the axe smoke

> **Executor instructions**: Follow each step and verify before continuing.
> STOP on drift.
>
> **Drift check (run first)**: `git diff --stat 61a60ba..HEAD -- scripts/smoke-a11y.mjs src/components/SiteHeader.astro`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `61a60ba`, 2026-09-03

## Why this matters

`scripts/smoke-a11y.mjs` is the only interactive verification CI runs
(`ci.yml` a11y job) and it only visits three pages in a desktop-like
viewport. The sticky header's interactive mobile menu
(`#menu-toggle`/`#mobile-menu`, `sm:hidden`) is never opened or exercised, so
the trap/Esc/aria-expanded logic can regress while CI stays green. Adding a
mobile-viewport pass over the home page and asserting menu-open behaviour
closes that gap.

## Current state

- `scripts/smoke-a11y.mjs` — axe-scan loop over `["", "privacy/", "404.html"]`
  with a shared `browser.newContext()` (no viewport override)
- `src/components/SiteHeader.astro` — mobile menu JS with
  `aria-expanded`/`hidden` + focus trap (selectors `#menu-toggle`,
  `#mobile-menu`)

Current State loop in `scripts/smoke-a11y.mjs`:

```js
const PATHS = ["", "privacy/", "404.html"];
const browser = await chromium.launch();
const context = await browser.newContext();
```

It runs `new AxeBuilder({ page }).analyze()` for each and fails if
`results.violations.length > 0`.

## Commands you will need

| Purpose       | Command                    | Expected on success                            |
| ------------- | -------------------------- | ---------------------------------------------- |
| Build         | `pnpm run build`           | exit 0                                         |
| Start preview | `nohup pnpm run preview &` | listening on 4321                              |
| Smoke         | `pnpm run smoke:a11y`      | `no violations found` across pages + menu pass |
| Quality gate  | `pnpm run check`           | exit 0                                         |

## Scope

**In scope**:

- `scripts/smoke-a11y.mjs` only

**Out of scope**:

- Any change to `src/components/SiteHeader.astro` or menu mark-up — the
  assertions shape what already exists.
- CI workflow wiring — `pnpm run smoke:a11y` invocation stays unchanged.

## Git workflow

- Branch: `advisor/004-axe-mobile-menu`
- Commit style: `test(a11y): モバイルメニュー開閉状態を axe スモークの対象に追加する`

## Steps

### Step 1: Add a mobile pass on the home page

After the existing `PATHS` loop (which must keep working unchanged), add a
second context pass bounded to the home page. Approximate shape (exact code
depends on `scripts/smoke-a11y.mjs` — use the actual selectors that exist
today):

```js
// Mobile viewport pass: verify the hamburger menu opens and is axe-clean.
const mobileCtx = await browser.newContext({
  viewport: { width: 375, height: 667 },
});
const page = await mobileCtx.newPage();
await page.goto(BASE_URL);
// toggle open
await page.click("#menu-toggle");
// menu must be open
const expanded = await page.getAttribute("#menu-toggle", "aria-expanded");
if (expanded !== "true") {
  throw new Error("mobile menu did not open (aria-expanded != true)");
}
const menuVisible = await page.isVisible("#mobile-menu");
if (!menuVisible) {
  throw new Error("mobile menu not visible after click");
}
// ... run axe
```

Run `new AxeBuilder({ page })` on the opened state and fail via the same
`violationCount` mechanism. Close the page, close the context.

Bonus (small): also Tab once to confirm focus moves into the menu — but the
axe pass must be the primary gate; do not ship only a Tab check.

**Verify**: `pnpm run build && nohup pnpm run preview & bash scripts/wait-for-preview.sh && pnpm run smoke:a11y` → exit 0, output shows the new mobile pass (log line such as `axe-core (mobile menu)`).

### Step 2: Confirm quality gate

`pnpm run check` → exit 0.

## Test plan

- The extended smoke itself is the test.
- CI picks it up without workflow changes.

## Done criteria

- [ ] `scripts/smoke-a11y.mjs` contains a mobile-viewport pass that opens the menu
- [ ] Assertions verify `aria-expanded == "true"` and `#mobile-menu` visibility
- [ ] Desktop `PATHS` loop unchanged
- [ ] `pnpm run smoke:a11y` exits 0; `pnpm run check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `#menu-toggle` / `#mobile-menu` selectors don't exist — header has been renamed.
- Axe reports new violations after opening the menu — report before adjusting
  the markup (out of scope).

## Maintenance notes

- If the menu renames IDs, update the selectors in the smoke only.
- Public-mode branch of axe coverage (REPO_IS_PUBLIC=true artifact) is
  deliberately out of scope; develop only private-mode behaviour.
