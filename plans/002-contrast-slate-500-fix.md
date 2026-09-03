# Plan 002: Promote `text-slate-500` body copy to `text-slate-400`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 61a60ba..HEAD -- src/styles/global.css src/components/SiteFooter.astro src/components/ProgramSection.astro src/components/HowItWorksSection.astro`
> Compare against "Current state"; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: a11y
- **Planned at**: commit `61a60ba`, 2026-09-03

## Why this matters

`text-slate-500` on `bg-slate-950` renders at ~3.8:1, below the WCAG AA 4.5:1
contrast minimum for normal text. Four low-criticality surfaces (footer
copyright/license, two `※` footnotes, and the disabled GitHub CTA shown when
`REPO_IS_PUBLIC=false`) rely on that token. Axe/Lighthouse thresholds (0.9)
pass above-scores, but the specific color-contrast rule can still regress
without a gate catching it — we raise the token rather than add gates.

Reassess: bump to `text-slate-400` (ratio ≈ 6.6:1) across the four sites.

## Current state

- `src/components/SiteFooter.astro` — footer copyright/license (`text-sm`)
- `src/components/ProgramSection.astro` — `※` footnote, `font-mono text-xs`
- `src/components/HowItWorksSection.astro` — `※` footnote, `font-mono text-xs`
- `src/styles/global.css` — `.btn-ghost-disabled` class (REPO gate CTA)

Current classes/state (verbatim; do not rewrite):

`src/components/SiteFooter.astro` (inner `<div>`):

```astro
<div
  class="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"
>
</div>
```

`src/components/ProgramSection.astro`:

```astro
<p class="mt-4 font-mono text-xs text-slate-500">※ 行動ルール UI ...</p>
```

`src/components/HowItWorksSection.astro`:

```astro
<p class="mt-4 font-mono text-xs text-slate-500">※ ...</p>
```

`src/styles/global.css` (excerpt from the `.btn-*` block):

```css
.btn-ghost-disabled {
  @apply cursor-not-allowed rounded-md border border-slate-800 px-6 py-3 font-semibold text-slate-500;
}
```

## Commands you will need

| Purpose       | Command                                                         | Expected on success |
| ------------- | --------------------------------------------------------------- | ------------------- |
| Quality gate  | `pnpm run check`                                                | exit 0              |
| Axe smoke     | `pnpm run build && (pnpm run preview &) && pnpm run smoke:a11y` | no violations found |
| Lighthouse CI | `pnpm run lhci`                                                 | passes thresholds   |

## Scope

**In scope**:

- `src/components/SiteFooter.astro`
- `src/components/ProgramSection.astro`
- `src/components/HowItWorksSection.astro`
- `src/styles/global.css`
- `dist/` rebuild artifacts (gitignored; ignored by `git status` cleanliness check)

**Out of scope**:

- Any other Tailwind slate token usages (e.g. `text-slate-400`,
  `text-slate-300`) — leave as-is.
- Design-direction revisions/cookies — token-only fix.

## Git workflow

- Branch: `advisor/002-contrast-slate-500`
- Commit style: `fix(a11y): 文字色 slate-500 を slate-400 に揚げて WCAG AA コントラスト基準を満たす`
- Do not push/PR unless the operator instructs.

## Steps

### Step 1: Update the four sites

Make the class substitution in each file:

- SiteFooter — `text-sm text-slate-500` → `text-sm text-slate-400`
- ProgramSection — `text-xs text-slate-500` → `text-xs text-slate-400`
- HowItWorksSection — `text-xs text-slate-500` → `text-xs text-slate-400`
- global.css `.btn-ghost-disabled` — `@apply ... text-slate-500;` → `@apply ... text-slate-400;`

**Verify**: `rg 'text-slate-500' src/components/SiteFooter.astro src/components/ProgramSection.astro src/components/HowItWorksSection.astro src/styles/global.css` → no matches.

### Step 2: Verify

Confirm no remaining slate-500 in in-scope files, run gate, build, and axe.

**Verify**:

- `pnpm run check` → exit 0
- `pnpm run build && nohup pnpm run preview > preview.log 2>&1 & bash scripts/wait-for-preview.sh && pnpm run smoke:a11y` → `no violations found` on all pages

## Done criteria

- [ ] In-scope files contain no `text-slate-500`
- [ ] `pnpm run check` exits 0
- [ ] Axe smoke exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The quoted class strings no longer match (drift).
- Axe smoke reports violations after rebuild — report before adjusting.
- You discover that `.btn-ghost-disabled` is theme-coupled beyond this token.

## Maintenance notes

- If the palette is revised in `docs/design-direction.md`, refresh this
  class choice rather than upstream tokens.
- Reviewer: keep the four `※` footnote paragraphs + disabled CTA reachable
  under REPO gate, not just during the public mode.
