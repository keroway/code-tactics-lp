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

  const rows = [0, 1, 2, 3].map((i) => {
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
      setInterval() {
        intervalActive = true;
        return 1;
      },
      clearInterval() {
        intervalActive = false;
      },
    },
    IntersectionObserver: FakeIntersectionObserver,
    Array,
  });

  return {
    state,
    rows,
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
