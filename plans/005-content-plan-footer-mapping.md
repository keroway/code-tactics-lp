# Plan 005: Point content-plan's footer entry to the real footer components

> **Executor instructions**: Follow the step; verify against "Current state";
> STOP on drift.
>
> **Drift check (run first)**: `git diff --stat 61a60ba..HEAD -- docs/content-plan.md`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `61a60ba`, 2026-09-03

## Why this matters

`docs/content-plan.md` section "9. **フッター / CTA**" claims the footer
lives in `Layout.astro` (`Layout.astro (Footer)`). In fact
`src/pages/index.astro` composes `src/components/FooterCta.astro` and
`src/components/SiteFooter.astro`; `Layout.astro` only renders the slot. A
doc that mis-locates key files derails anyone following it and gets stale
fast — fix the mapping.

## Current state

`docs/content-plan.md` (section 9, ~line 49):

```md
9. **フッター / CTA** — `Layout.astro` (Footer)
   - プレイ導線・GitHub・ライセンス・クレジット
```

Files that actually comprise the footer:

- `src/components/FooterCta.astro` — play CTA block
- `src/components/SiteFooter.astro` — license / privacy / GitHub

## Scope

**In scope**:

- `docs/content-plan.md`
  (rewrite the wrong entry to the two real components)

**Out of scope**:

- Any source file
- Any other section of the content-plan

## Git workflow

- Branch: `advisor/005-content-plan-footer`
- Commit style: `docs: フッター対応表を FooterCta/SiteFooter に修正する`

## Steps

### Step 1: Update the entry

In `docs/content-plan.md` rewrite section 9 to name both components:

```md
9. **フッター / CTA** — `FooterCta` + `SiteFooter`
   - プレイ導線 (CTA)・GitHub・ライセンス・プライバシーリンク
```

**Verify**: `pnpm run format:check` → exit 0 (Prettier on .md).

## Test plan

Docs-only — formatting is the only check.

## Done criteria

- [ ] `docs/content-plan.md` no longer names `Layout.astro` as the footer
- [ ] `pnpm run format:check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Section 9 text differs from the excerpt (drifted).

## Maintenance notes

- When footer rendering moves again, update the mapping, not just the source.
