import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// src/components/HeroSection.astro の <script is:inline> を抽出して Node VM で実行する。
// ブラウザは使わず、MediaQueryList と IntersectionObserver の通知をスタブで制御する。
const HERO_SECTION = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "HeroSection.astro"
);

function loadInlineScript() {
  const source = readFileSync(HERO_SECTION, "utf8");
  const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
  assert.ok(match, "HeroSection.astro に <script is:inline> が見つからない");
  return match[1];
}

function setupHarness() {
  const state = { plays: 0, pauses: 0, listeners: 0, disconnected: 0 };
  let ioCallback;
  let changeHandler;

  class Video {
    play() {
      state.plays++;
      return Promise.resolve();
    }
    pause() {
      state.pauses++;
    }
  }
  const video = new Video();

  const mediaQuery = {
    matches: false,
    addEventListener(type, cb) {
      state.listeners++;
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
    document: { querySelector: () => video },
    HTMLVideoElement: Video,
    window: {
      matchMedia: () => mediaQuery,
      IntersectionObserver: FakeIntersectionObserver,
    },
    IntersectionObserver: FakeIntersectionObserver,
  });

  return {
    state,
    mediaQuery,
    enter() {
      ioCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    },
    leave() {
      ioCallback([{ isIntersecting: false, intersectionRatio: 0 }]);
    },
    toggleReduceMotion(matches) {
      mediaQuery.matches = matches;
      assert.ok(changeHandler, "change リスナーが登録されていない");
      changeHandler({ matches });
    },
  };
}

test("通常設定の初期表示では自動再生する", () => {
  const h = setupHarness();
  h.enter();
  assert.equal(h.state.plays, 1);
});

test("再生中に reduced-motion へ切り替わると一時停止する", () => {
  const h = setupHarness();
  h.enter();
  h.toggleReduceMotion(true);
  assert.equal(h.state.pauses, 1);
  assert.equal(h.state.disconnected, 1);
});

test("reduced-motion へ切り替わった後は viewport 再入場でも再生しない", () => {
  const h = setupHarness();
  h.enter();
  h.toggleReduceMotion(true);
  h.leave();
  h.enter();
  assert.equal(h.state.plays, 1);
});
