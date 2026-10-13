import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// src/components/HowItWorksSection.astro の <script is:inline> を抽出して Node VM で実行する。
// ブラウザは使わず、MediaQueryList と IntersectionObserver の通知をスタブで制御する。
const HOW_IT_WORKS_SECTION = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "HowItWorksSection.astro"
);

function loadInlineScript() {
  const source = readFileSync(HOW_IT_WORKS_SECTION, "utf8");
  const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
  assert.ok(
    match,
    "HowItWorksSection.astro に <script is:inline> が見つからない"
  );
  return match[1];
}

function makeContainer() {
  const children = [];
  const cursor = { isCursor: true };
  children.push(cursor);
  return {
    querySelector: () => cursor,
    // 実 DOM と同じく ref の直前へ挿入する (カーソルは常に末尾に残る)。
    insertBefore(row, ref) {
      const i = children.indexOf(ref);
      children.splice(i < 0 ? children.length : i, 0, row);
    },
    get children() {
      return children;
    },
    get firstElementChild() {
      return children[0];
    },
    removeChild(el) {
      const i = children.indexOf(el);
      if (i >= 0) children.splice(i, 1);
    },
  };
}

function setupHarness() {
  const state = { disconnected: 0 };
  let ioCallback;
  let changeHandler;
  let intervalActive = false;
  let intervalCallback = null;
  let intervalMs = null;

  const container = makeContainer();

  const mediaQuery = {
    matches: false,
    addEventListener(type, cb) {
      if (type === "change") changeHandler = cb;
    },
  };

  class FakeIntersectionObserver {
    constructor(cb) {
      ioCallback = cb;
    }
    observe() {}
    disconnect() {
      state.disconnected++;
    }
  }

  vm.runInNewContext(loadInlineScript(), {
    document: {
      getElementById: () => container,
      createElement: () => {
        const classes = new Set();
        return {
          className: "",
          textContent: "",
          classList: {
            add(name) {
              classes.add(name);
            },
            has(name) {
              return classes.has(name);
            },
          },
        };
      },
    },
    window: {
      matchMedia: () => mediaQuery,
      IntersectionObserver: FakeIntersectionObserver,
      setInterval(cb, ms) {
        intervalActive = true;
        intervalCallback = cb;
        intervalMs = ms;
        return 1;
      },
      clearInterval() {
        intervalActive = false;
        intervalCallback = null;
      },
      requestAnimationFrame(cb) {
        cb();
      },
    },
    IntersectionObserver: FakeIntersectionObserver,
    requestAnimationFrame(cb) {
      cb();
    },
  });

  return {
    state,
    container,
    cursor: container.querySelector(),
    intervalMs: () => intervalMs,
    // 登録された周期処理を 1 回分進める。停止中は呼べない。
    tick() {
      assert.ok(intervalCallback, "周期処理が登録されていない");
      intervalCallback();
    },
    // カーソルを除いたログ行のテキスト (DOM 順)
    lines: () =>
      container.children
        .filter((el) => !el.isCursor)
        .map((el) => el.textContent),
    isRunning: () => intervalActive,
    enter() {
      ioCallback([{ isIntersecting: true }]);
    },
    leave() {
      ioCallback([{ isIntersecting: false }]);
    },
    toggleReduceMotion(matches) {
      mediaQuery.matches = matches;
      assert.ok(changeHandler, "change リスナーが登録されていない");
      changeHandler({ matches });
    },
  };
}

test("通常設定で viewport に入るとストリームを開始する", () => {
  const h = setupHarness();
  h.enter();
  assert.equal(h.isRunning(), true);
});

test("再生中に reduced-motion へ切り替わると停止する", () => {
  const h = setupHarness();
  h.enter();
  h.toggleReduceMotion(true);
  assert.equal(h.isRunning(), false);
  assert.equal(h.state.disconnected, 1);
});

test("reduced-motion へ切り替わった後は viewport 再入場でも再開しない", () => {
  const h = setupHarness();
  h.enter();
  h.toggleReduceMotion(true);
  h.leave();
  h.enter();
  assert.equal(h.isRunning(), false);
});

test("開始時に 1 行出力し、tick ごとに順にログが追記されカーソルは末尾に残る", () => {
  const h = setupHarness();
  h.enter();
  assert.equal(h.intervalMs(), 1400);
  assert.deepEqual(h.lines(), [
    "> tick 117  cpu-tank  eval attack-when-ready  -> false",
  ]);
  h.tick();
  h.tick();
  assert.deepEqual(h.lines(), [
    "> tick 117  cpu-tank  eval attack-when-ready  -> false",
    "> tick 118  cpu-tank  eval approach-detected-enemy -> true",
    "> tick 118  cpu-tank  action approach(player-tank)",
  ]);
  assert.equal(h.container.children.at(-1), h.cursor);
  const last = h.container.children.at(-2);
  assert.equal(last.className, "log-stream-line");
  assert.equal(last.classList.has("is-visible"), true);
});

test("ログは最大 6 行に間引かれ、古い行から消えてカーソルを保持し、末尾後は先頭へ循環する", () => {
  const h = setupHarness();
  h.enter();
  for (let i = 0; i < 7; i++) h.tick(); // 計 8 行 = 1 周
  assert.equal(h.lines().length, 6);
  assert.equal(h.container.children.length, 7);
  assert.equal(h.container.children.at(-1), h.cursor);
  assert.equal(
    h.lines()[0],
    "> tick 118  cpu-tank  action approach(player-tank)"
  );
  assert.equal(
    h.lines().at(-1),
    "> tick 120  cpu-tank  action attack(player-tank)"
  );
  h.tick(); // 9 行目は先頭の行へ戻る
  assert.equal(
    h.lines().at(-1),
    "> tick 117  cpu-tank  eval attack-when-ready  -> false"
  );
  assert.equal(h.lines().length, 6);
});

test("viewport を出ると周期処理が解除され追記が止まる", () => {
  const h = setupHarness();
  h.enter();
  h.tick();
  h.leave();
  assert.equal(h.isRunning(), false);
  assert.throws(() => h.tick(), /周期処理が登録されていない/);
  assert.equal(h.lines().length, 2);
});
