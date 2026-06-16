// LP 全体で共有する定数。複数のコンポーネントから参照する。

// 外部リンク (本体リポジトリ / web 版プレイ)。
export const PLAY_URL = "https://keroway.github.io/code-tactics/";
export const REPO_URL = "https://github.com/keroway/code-tactics";

// 外部リンク共通属性。新規タブで開き、安全のため rel を付与する。
// 各 <a> に {...EXTERNAL_LINK_ATTRS} で展開し、新規タブ遷移はリンクごとの
// aria-label（「…（新しいタブで開く）」）でスクリーンリーダーにも伝える。
export const EXTERNAL_LINK_ATTRS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

// aria-label を「<ラベル>（新しいタブで開く）」形式で生成するヘルパー。
export const externalLinkLabel = (label: string) =>
  `${label}（新しいタブで開く）`;

// 回遊ナビのリンク。デスクトップナビ / モバイルメニューで共用する。
export const NAV_LINKS = [
  { href: "#concept", label: "コンセプト" },
  { href: "#how-to-play", label: "遊び方" },
  { href: "#features", label: "特徴" },
  { href: "#roadmap", label: "ロードマップ" },
  { href: "#faq", label: "FAQ" },
];
