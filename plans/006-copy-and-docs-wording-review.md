# Plan 006: Polish Japanese copy, tone, and doc consistency across `src/` and `docs/`

> **Executor instructions**: Review each enumerated finding; verify against "Current state";
> apply the suggested rewrites and verify formatting and checks. STOP on drift.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: content / docs / a11y
- **Planned at**: commit `61a60ba`, 2026-09-03

## Why this matters

The landing page (LP) is the primary public entry point for `code-tactics`. While the visual design and CI gates are in place, a thorough audit of all Japanese copy in `src/` and documentation in `docs/` revealed several issues across four categories:

1. **Factual contradictions & A11y defects**:
   - `HeroSection.astro`: The fallback screenshot's `aria-label` says the rule editor is on the "left" ("左に行動ルールエディタ"), while its `alt` text correctly says "right" ("右パネルの行動ルールエディタ"). The editor is on the right side.
   - `HowItWorksSection.astro`: The footnote claims "現在はプログラムタブや複数ユニット編成...も追加されている" (currently program tab and multi-unit battles have also been added), but images #3 and #4 in that very section already showcase the program editor and multi-unit battle. This is stale copy from when only 2 screenshots were displayed.
   - `docs/decisions.md` vs `src/consts.ts`: `decisions.md` says UTM parameters are added to GitHub CTA links, whereas `src/consts.ts` and code intentionally omit them because GitHub does not forward UTM.
   - `docs/design-direction.md`: Broken anchor link to `#用意したいアセット` in `docs/content-plan.md` (the heading was renamed to `## 用意したアセット (差し込み済み)`).

2. **Unnatural phrasing & developer-internal tone**:
   - `FeaturesSection.astro`: Contains the abrupt imperative "山を登れ" ("静的入力からテキスト編集まで山を登れ、どちらから始めても OK。"), which reads like internal developer shorthand or a typo for "ステップアップでき".
   - `HowToPlaySection.astro`: "操作はしない。" is blunt and reads awkwardly as player onboarding instructions.
   - Developer-centric release notes tone in marketing copy: Phrases like "〜まで広がった" (`HeroSection`), "1on1 MVP から大きく進み" (`FaqSection`), and "1on1 MVP から、...まで実装が進んでいる" (`RoadmapSection`) reflect developer progress reports rather than benefits for first-time visitors.
   - `FaqSection.astro`: Unnatural em-dash connections ("インストール不要 — 「今すぐプレイ」から...") and unnecessary exposure of framework names ("(Tauri)").

3. **Terminology & Notation drift**:
   - "GUI" vs "UI": `FeaturesSection` and `ProgramSection` introduce "GUI" while the rest of the site uses "UI" / "行動ルール UI".
   - Header label discrepancy: `ProgramSection` displays `gambits — player-tank`, while the rest of the site uses "行動ルール" and `HowItWorksSection` uses `rule editor — player-tank`. "gambits" is confusing internal jargon for visitors.
   - Variations in naming the program syntax: "テキストプログラム", "テキストの簡易プログラム", "簡易プログラム言語", "テキストの簡易プログラム言語".
   - Roadmap versioning: `MVP–v0.2`, `v0.3`, `v0.4`, `v0.5`, `戦闘刷新`, `v1.0` — `戦闘刷新` is an epic name without a version identifier, and its last list item uses a verb ending ("バランス調整は継続中") rather than noun form like other items.

---

## Findings and Planned Rewrites

### 1. `src/components/HeroSection.astro`

#### Finding 1-1 (A11y / Accuracy): Left/Right contradiction in screenshot description

- **Current (L100)**:
  ```astro
  aria-label="code-tactics のゲーム画面。左に行動ルールエディタ、中央に 2
  体の戦車が接近する戦場キャンバス、下にリアルタイム戦闘ログ"
  ```
- **Fix**: Change "左に行動ルールエディタ" to "右パネルに行動ルールエディタ":
  ```astro
  aria-label="code-tactics のゲーム画面。中央キャンバスで 2
  体の戦車が接近し、右パネルに行動ルールエディタ、下にリアルタイム戦闘ログ"
  ```

#### Finding 1-2 (Tone / Readability): Developer-centric listing in hero lead copy

- **Current (L48-50)**:
  ```astro
  軽戦車・重戦車・偵察ドローン・ミサイル車両、障害物、キャンペーン、非同期対戦まで広がった、
  観察とデバッグが中核のプログラマブル・オートバトル。
  ```
- **Fix**: Rephrase to user-centric features:
  ```astro
  軽戦車・重戦車・ドローン・ミサイルなど多彩なユニットと戦術要素、キャンペーンから非同期対戦までを備えた、
  観察とデバッグが中核のプログラマブル・オートバトル。
  ```

---

### 2. `src/components/ConceptSection.astro`

#### Finding 2-1 (Clarity): "腕前" ambiguity

- **Current (L11-12)**:
  ```astro
  プレイヤーの腕前ではなく、組んだ AI と編成の良し悪しで勝敗が決まる。
  ```
- **Fix**: Clarify that it refers to real-time player control skills vs AI logic:
  ```astro
  プレイヤーの操作テクニックではなく、組んだ AI と編成の良し悪しで勝敗が決まる。
  ```

---

### 3. `src/components/HowToPlaySection.astro`

#### Finding 3-1 (Tone): Blunt phrasing "操作はしない。"

- **Current (L14)**:
  ```ts
  body: "操作はしない。複数ユニットが障害物や射線、武器の違いを踏まえて動く様子を観察する。",
  ```
- **Fix**:
  ```ts
  body: "戦闘中の操作は不要。複数ユニットが障害物や射線、武器の違いを踏まえて動く様子を見守る。",
  ```

#### Finding 3-2 (Consistency): UI naming

- **Current (L9)**:
  ```ts
  body: "行動ルール式 UI、またはテキストの簡易プログラムでユニットの AI を設計する。",
  ```
- **Fix**:
  ```ts
  body: "行動ルール UI、またはテキストの簡易プログラム言語でユニットの AI を設計する。",
  ```

---

### 4. `src/components/FeaturesSection.astro`

#### Finding 4-1 (Readability / Wording): "山を登れ" imperative and "OK" colloquialism

- **Current (L8)**:
  ```ts
  body: "条件と行動を GUI で並べる行動ルールと、テキストの簡易プログラム言語は相互変換できる。静的入力からテキスト編集まで山を登れ、どちらから始めても OK。",
  ```
- **Fix**:
  ```ts
  body: "条件と行動を並べる行動ルール UI と、テキストの簡易プログラム言語は相互変換に対応。直感的な選択からテキスト編集まで習熟度に合わせてステップアップでき、どちらからでも自由に始められる。",
  ```

#### Finding 4-2 (Readability): Bullet-point style listing in card body

- **Current (L12)**:
  ```ts
  body: "軽戦車・重戦車・偵察ドローン・ミサイル車両、複数武器、障害物、射線、経路探索、地上/航空レイヤーに対応。",
  ```
- **Fix**:
  ```ts
  body: "軽戦車・重戦車・偵察ドローン・ミサイル車両をはじめ、多彩な武器、障害物や射線、経路探索、地上/航空レイヤーなど奥深い戦術要素に対応。",
  ```

---

### 5. `src/components/ProgramSection.astro`

#### Finding 5-1 (Terminology / Flow): GUI vs UI and redundant wording

- **Current (L18-22)**:
  ```astro
  行動ルール UI
  で並べたルールは、テキストの簡易プログラム言語に変換して編集できる。
  両者は相互に変換でき、どちらで書いても結果は変わらない。 GUI
  で大まかに組み、細かい条件はテキストで調整するといった使い方もできる。
  ```
- **Fix**:
  ```astro
  行動ルール UI
  で並べたルールは、テキストの簡易プログラム言語に相互変換して編集できる。
  どちらで記述しても動作結果は同一。ビジュアル UI
  で大まかに骨格を組み、細かい条件はテキストで調整するといった柔軟な使い方もできる。
  ```

#### Finding 5-2 (Consistency): Header bar label `gambits`

- **Current (L38)**:
  ```astro
  <span class="ml-2">gambits — player-tank</span>
  ```
- **Fix**: Change to `rules` or `rule editor` to match other sections:
  ```astro
  <span class="ml-2">rules — player-tank</span>
  ```

#### Finding 5-3 (Tone): Footnote sentence ending

- **Current (L119-121)**:
  ```astro
  ※ 行動ルール UI
  とテキストは双方向に変換できる。構文は実際のゲームのものを掲載。
  ```
- **Fix**:
  ```astro
  ※ 行動ルール UI
  とテキストは双方向で相互変換できます。構文サンプルは実際のゲームで動作するものを掲載しています。
  ```

---

### 6. `src/components/HowItWorksSection.astro`

#### Finding 6-1 (Factual Contradiction): Stale footnote claiming features are missing from images

- **Current (L126-128)**:
  ```astro
  ※
  上記はゲームの実際の画面。現在はプログラムタブや複数ユニット編成、キャンペーンや非同期対戦も追加されている。
  ```
- **Fix**: Update footnote to accurately describe that current images already include program editor & multi-unit, and highlight further modes:
  ```astro
  ※
  上記は実際のゲーム画面です。現在はソロプレイ用キャンペーンや非同期対戦・ランキング機能なども実装されています。
  ```

#### Finding 6-2 (Clarity): `TankA` reference in aria-label

- **Current (L19)**:
  ```astro
  aria-label="ルールエディタの実画面。TankA の行動ルールを優先順に並べた一覧：#1
  敵が射程内かつ武器使用可なら攻撃、#2 敵を発見したら近づく、#3 常に停止"
  ```
- **Fix**: Match `player-tank`:
  ```astro
  aria-label="ルールエディタの実画面。味方戦車 (player-tank)
  の行動ルールを優先順に並べた一覧：#1 敵が射程内かつ武器使用可なら攻撃、#2
  敵を発見したら近づく、#3 常に停止"
  ```

---

### 7. `src/components/RoadmapSection.astro`

#### Finding 7-1 (Structure): Milestone name & item ending consistency

- **Current (L45, L60)**:
  - Version: `"戦闘刷新"`
  - Item: `"バランス調整は継続中"`
- **Fix**:
  - Version: `"v0.6 (戦闘刷新)"` or `"戦闘システム刷新"`
  - Item: `"ゲームバランスの調整・磨き込み (継続中)"`

#### Finding 7-2 (Tone): Lead copy progress report style

- **Current (L70-73)**:
  ```astro
  1on1 MVP から、複数ユニット戦、障害物、ユニット/武器種、簡易プログラム言語、
  キャンペーン
  (チュートリアル兼用)、非同期対戦、プレイヤープロフィールまで実装が進んでいる。
  今後はバランス調整を磨き込む段階。
  ```
- **Fix**:
  ```astro
  1on1
  の基本形から、複数ユニット戦、障害物、ユニット・武器種、簡易プログラム言語、
  キャンペーン
  （チュートリアル兼用）、非同期対戦、プレイヤープロフィールまで実装が完了。
  現在は正式リリースに向けたバランス調整を磨き込む段階に入っています。
  ```

---

### 8. `src/components/FaqSection.astro`

#### Finding 8-1 (Tone / Clarity): Jargon "1on1 MVP" in visitor FAQ

- **Current (L26)**:
  ```ts
  a: "1on1 MVP から大きく進み、複数ユニット編成、障害物・射線・経路探索、ユニット/武器種、簡易プログラム言語、キャンペーン (全16課題でチュートリアルを兼ねる)、非同期対戦、ランキング、リプレイ共有、プレイヤープロフィール (表示名・アバター色・累積統計) まで実装されています。バランス調整は継続中です。",
  ```
- **Fix**:
  ```ts
  a: "基本となる自動戦闘に加え、複数ユニット編成、障害物・射線・経路探索、多彩なユニットや武器種、簡易プログラム言語、キャンペーン（全16課題・チュートリアル兼用）、非同期対戦、ランキング、リプレイ共有、プレイヤープロフィール（表示名・アバター色・累積統計）まで幅広く実装されています。現在は対戦環境のバランス調整を継続しています。",
  ```

#### Finding 8-2 (Style / Terminology): Dash syntax & internal framework mention

- **Current (L18)**:
  ```ts
  a: "無料で遊べます。Web 版はモダンなブラウザで動作しインストール不要 — 「今すぐプレイ」からすぐに始められます。Windows / macOS / Linux のデスクトップ版 (Tauri) は準備中で、配布準備が整い次第案内します。",
  ```
- **Fix**:
  ```ts
  a: "無料で遊べます。Web 版はモダンなブラウザに対応しており、インストール不要で「今すぐプレイ」からすぐに始められます。Windows / macOS / Linux 向けのデスクトップアプリ版は準備中で、配布の準備が整い次第ご案内します。",
  ```

#### Finding 8-3 (Tone): "OK です" in FAQ answer

- **Current (L10)**:
  ```ts
  a: "不要です。行動ルール式 UI (「もし〜なら〜する」を優先順に並べるだけ) で十分遊べます。また、同じルールをテキストの簡易プログラム言語でも書けます。行動ルールとテキストは相互変換できるので、どちらから始めても OK です。",
  ```
- **Fix**:
  ```ts
  a: "不要です。行動ルール UI（「もし〜なら〜する」を優先順に並べるだけ）で十分に楽しめます。また、同じルールをテキストの簡易プログラム言語で記述することも可能です。両者は相互変換できるため、どちらの形式から始めても問題ありません。",
  ```

---

### 9. `docs/` Documents

#### Finding 9-1: `docs/decisions.md` vs `src/consts.ts` UTM discrepancy

- **Current (`docs/decisions.md` L96-98)**:
  "github.com/keroway/code-tactics への CTA には UTM を付与するが、GitHub は UTM パラメータを解析に反映しない。best-effort 対応（計測不可）と割り切り..."
- **Fix**: Align with `src/consts.ts` ("REPO_URL は解析に反映しないため対象外 (付与しない)"):
  "github.com/keroway/code-tactics への CTA は、GitHub 側が UTM パラメータを解析に反映しないため付与対象外（付与しない）とし、プレイ用 URL への流入を主指標とする。"

#### Finding 9-2: `docs/design-direction.md` broken anchor

- **Current (`docs/design-direction.md` L84)**:
  `[content-plan.md](./content-plan.md#用意したいアセット) と共通:`
- **Fix**:
  `[content-plan.md](./content-plan.md#用意したアセット-差し込み済み) と共通:`

#### Finding 9-3: `docs/tech-stack.md` particle omission

- **Current (`docs/tech-stack.md` L34-35)**:
  "チームの慣れや今後デモを本体由来のコンポーネントで作りたいかで選ぶとよい。"
- **Fix**:
  "チームの慣れや今後デモを本体由来のコンポーネントで作りたいかどうかで選ぶとよい。"

---

## Scope

**In scope**:

- `src/components/HeroSection.astro`
- `src/components/ConceptSection.astro`
- `src/components/HowToPlaySection.astro`
- `src/components/FeaturesSection.astro`
- `src/components/ProgramSection.astro`
- `src/components/HowItWorksSection.astro`
- `src/components/RoadmapSection.astro`
- `src/components/FaqSection.astro`
- `docs/decisions.md`
- `docs/design-direction.md`
- `docs/tech-stack.md`
- `docs/content-plan.md`

**Out of scope**:

- Structural markup or layout changes
- Color palette or token changes

## Commands you will need

| Purpose      | Command                                                         | Expected on success |
| ------------ | --------------------------------------------------------------- | ------------------- |
| Quality gate | `pnpm run check`                                                | exit 0              |
| Axe smoke    | `pnpm run build && (pnpm run preview &) && pnpm run smoke:a11y` | no violations found |
| Format check | `pnpm run format:check`                                         | exit 0              |

## Done criteria

- [x] All 9 findings addressed in source and documentation
- [x] No factual contradiction between screenshot image and descriptive texts
- [x] No stale claims in HowItWorks footnote
- [x] "山を登れ" and developer shorthand eliminated from public LP
- [x] `pnpm run check` exits 0
- [x] `pnpm run format:check` exits 0
- [x] `plans/README.md` status row updated
