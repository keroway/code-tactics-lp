import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// src/components/ProgramSection.astro の <script is:inline> を抽出して Node VM で実行する。
// ブラウザは使わず、MediaQueryList と IntersectionObserver の通知をスタブで制御する。
const PROGRAM_SECTION = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "ProgramSection.astro"
);

function loadInlineScript() {
  const source = readFileSync(PROGRAM_SECTION, "utf8");
  const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
  assert.ok(match, "ProgramSection.astro に <script is:inline> が見つからない");
  return match[1];
}

function setupHarness() {
  const state = { disconnected: 0 };
  let ioCallback;
  let changeHandler;
  let intervalActive = false;
  let intervalCallback = null;
  let intervalMs = null;

  // 実マークアップと同じく、左右 2 組 (index 0〜3 が 2 回) の行を用意する。
  const rows = [0, 1, 2, 3, 0, 1, 2, 3].map((i) => {
    const classes = new Set();
    return {
      getAttribute: () => String(i),
      classList: {
        toggle(name, on) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
        remove(name) {
          classes.delete(name);
        },
        has(name) {
          return classes.has(name);
        },
      },
    };
  });

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

  const section = {
    querySelectorAll: () => rows,
  };

  vm.runInNewContext(loadInlineScript(), {
    document: { getElementById: () => section },
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
    },
    IntersectionObserver: FakeIntersectionObserver,
    Array,
  });

  return {
    state,
    rows,
    intervalMs: () => intervalMs,
    // 登録された周期処理を 1 回分進める。停止中は呼べない。
    tick() {
      assert.ok(intervalCallback, "周期処理が登録されていない");
      intervalCallback();
    },
    // 強調中の行の位置 (rows 配列の添字) を返す
    activePositions: () =>
      rows.flatMap((el, pos) => (el.classList.has("is-active") ? [pos] : [])),
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

test("通常設定で viewport に入るとハイライトを開始する", () => {
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

test("開始時に index 0 の左右 2 行が同時に強調される", () => {
  const h = setupHarness();
  h.enter();
  assert.equal(h.intervalMs(), 1600);
  assert.deepEqual(h.activePositions(), [0, 4]);
});

test("tick ごとに左右の同じ index が 0→3 と巡回し、一周して 0 へ戻る", () => {
  const h = setupHarness();
  h.enter();
  const seen = [h.activePositions()];
  for (let i = 0; i < 4; i++) {
    h.tick();
    seen.push(h.activePositions());
  }
  assert.deepEqual(seen, [
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
    [0, 4],
  ]);
});

test("viewport を出ると強調が消え、再入場で再開する", () => {
  const h = setupHarness();
  h.enter();
  h.tick();
  h.leave();
  assert.deepEqual(h.activePositions(), []);
  assert.equal(h.isRunning(), false);
  h.enter();
  assert.equal(h.isRunning(), true);
  assert.equal(h.activePositions().length, 2);
});

test("reduced-motion へ切り替わると強調が消える", () => {
  const h = setupHarness();
  h.enter();
  h.tick();
  h.toggleReduceMotion(true);
  assert.deepEqual(h.activePositions(), []);
});
