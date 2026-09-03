# Plan 003: Extract the duplicated `walkHtml` generator to a shared helper

> **Executor instructions**: Follow each step; run the verification command
> before continuing. STOP on mismatch against "Current state".
>
> **Drift check (run first)**: `git diff --stat 61a60ba..HEAD -- scripts/check-repo-gate.mjs scripts/check-hero-video.mjs`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `61a60ba`, 2026-09-03

## Why this matters

Both CI gate scripts (`check-repo-gate.mjs`, `check-hero-video.mjs`) inline an
identical `walkHtml` async generator that walks `dist/` and yields `.html`
files. Two copies of the same traversal drift when a fix lands in only one —
and both gates guard entry criteria (REPO public toggle, hero-video
fallback). Collapse to one module so the traversal can't diverge.

## Current state

- `scripts/check-repo-gate.mjs` — REPO_IS_PUBLIC gate (uses `walkHtml`)
- `scripts/check-hero-video.mjs` — hero video fallback gate (uses `walkHtml`)

Each contains verbatim (same body):

```js
async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(path);
    } else if (entry.name.endsWith(".html")) {
      yield path;
    }
  }
}
```

## Commands you will need

| Purpose     | Command                     | Expected on success    |
| ----------- | --------------------------- | ---------------------- |
| Lint/format | `pnpm run check`            | exit 0                 |
| Build       | `pnpm run build`            | exit 0                 |
| Gate 1      | `pnpm run check:repo-gate`  | `check-repo-gate: OK`  |
| Gate 2      | `pnpm run check:hero-video` | `check-hero-video: OK` |

## Scope

**In scope**:

- `scripts/check-repo-gate.mjs` (remove inline walkHtml; import it)
- `scripts/check-hero-video.mjs` (same)
- `scripts/lib/walk-html.mjs` (NEW — exported `walkHtml`)

**Out of scope**:

- `scripts/smoke-a11y.mjs` (different purpose; do not unify)
- CI workflow `.github/workflows/ci.yml` gate wiring — unchanged
- Anything under `src/`

## Git workflow

- Branch: `advisor/003-dedup-walk-html`
- Commit style: `refactor(scripts): walkHtml ジェネレータを共通化して 2 つのゲートの重複を解消する`

## Steps

### Step 1: Create the helper

Add `scripts/lib/walk-html.mjs`:

```js
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// dist/ 以下の .html を再帰的に走査する。REPO_IS_PUBLIC ゲートと hero 動画ゲートの
// 共用ヘルパ。呼び出し側は for await (const file of walkHtml(dist)) で消費する。
export async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(path);
    } else if (entry.name.endsWith(".html")) {
      yield path;
    }
  }
}
```

**Verify**: `ls scripts/lib/walk-html.mjs` → exists.

### Step 2: Replace inline definitions in both gates

In `scripts/check-repo-gate.mjs` and `scripts/check-hero-video.mjs`:

- delete the local `async function* walkHtml` definition
- add import:

```js
import { walkHtml } from "./lib/walk-html.mjs";
```

Remove the now-unused `readdir`/`join` imports if they were only used by the
removed generator (keep anything still used elsewhere in the file — both
scripts still need `readFile`).

**Verify**:

- `rg 'async function\* walkHtml' scripts/` → no matches (inline generators removed)
- `rg 'lib/walk-html' scripts/check-*.mjs` → one import match per gate script

### Step 3: Verify gates still pass

**Verify**: `pnpm run check` → exit 0; `pnpm run build && pnpm run check:repo-gate && pnpm run check:hero-video` → each prints OK.

## Test plan

- No new tests; the gate _is_ the test for this refactor.
- Do both gates locally (mirrors CI behaviour).

## Done criteria

- [ ] `scripts/lib/walk-html.mjs` exists; both gate scripts import it
- [ ] No `async function* walkHtml` remains inline in either gate
- [ ] `pnpm run check` exits 0
- [ ] `check:repo-gate` and `check:hero-video` both succeed after `pnpm run build`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Scripts' `walkHtml` bodies diverge from the excerpt (drifted).
- Import resolution fails (e.g. wrong relative path) — report before renaming.

## Maintenance notes

- Future gate scripts that need `dist/` traversal must import from
  `scripts/lib/`, not re-implement.
