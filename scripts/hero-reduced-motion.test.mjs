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

  const videoHandlers = { pause: [], play: [] };
  class Video {
    addEventListener(type, cb) {
      videoHandlers[type].push(cb);
    }
    paused = true;
    play() {
      this.paused = false;
      state.plays++;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
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
    video,
    mediaQuery,
    enter() {
      ioCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    },
    leave() {
      ioCallback([{ isIntersecting: false, intersectionRatio: 0 }]);
    },
    // 実ブラウザの pause / play イベント (利用者の controls 操作または自動停止・再生の結果)
    fire(type) {
      for (const cb of videoHandlers[type]) cb({ type });
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

test("手動停止後は viewport 再入場でも再生しない", () => {
  const h = setupHarness();
  h.enter();
  h.fire("pause"); // 表示中に利用者が controls で停止
  h.leave();
  h.fire("pause"); // 画面外移動による自動停止の pause イベント
  h.enter();
  assert.equal(h.state.plays, 1);
});

test("自動停止後の再入場では再生する", () => {
  const h = setupHarness();
  h.enter();
  h.leave();
  h.fire("pause");
  h.enter();
  assert.equal(h.state.plays, 2);
});

test("再入場後に遅延して届いた自動停止の pause 通知を手動停止と誤認しない", () => {
  const h = setupHarness();
  h.enter();
  h.leave();
  h.enter();
  h.fire("pause"); // 最初の自動停止に対応する遅延通知
  h.leave();
  h.fire("pause");
  h.enter();
  assert.equal(h.state.plays, 3);
});

test("遅延通知の後でも、表示中の手動停止は尊重する", () => {
  const h = setupHarness();
  h.enter();
  h.leave();
  h.enter();
  h.fire("pause"); // 自動停止の遅延通知
  h.fire("play");
  h.fire("pause"); // 利用者が controls で停止
  h.leave();
  h.fire("pause");
  h.enter();
  assert.equal(h.state.plays, 2);
});

test("画面外移動後に届いた手動停止の pause 通知も手動停止として保持する", () => {
  const h = setupHarness();
  h.enter();
  h.fire("play");
  h.video.pause(); // 利用者が controls で停止 (通知はまだ届いていない)
  h.leave(); // 既に paused なので自動停止は数えない
  h.fire("pause"); // 手動停止の遅延通知
  h.enter();
  assert.equal(h.state.plays, 1);
});

test("手動停止後に利用者が再生し直すと、再入場で再び自動再生する", () => {
  const h = setupHarness();
  h.enter();
  h.fire("pause");
  h.fire("play"); // 利用者が controls で再生
  h.leave();
  h.fire("pause");
  h.enter();
  assert.equal(h.state.plays, 2);
});
