// LP 全体で共有する定数。複数のコンポーネントから参照する。

// 外部リンク (本体リポジトリ / web 版プレイ)。
export const PLAY_URL = "https://keroway.github.io/code-tactics/";
export const REPO_URL = "https://github.com/keroway/code-tactics";

// 「今すぐプレイ」CTA に UTM パラメータを付与するヘルパー。
// 遷移先 (code-tactics 本体) の Cloudflare Analytics で LP 経由の流入を
// 出現箇所別 (utm_content) に区別する。命名規約は docs/decisions.md 決定4が正典。
// REPO_URL (github.com) は UTM を解析に反映しないため対象外 (付与しない)。
export const withUtm = (url: string, content: string): string => {
  const params = new URLSearchParams({
    utm_source: "lp",
    utm_medium: "cta",
    utm_campaign: "lp-cta",
    utm_content: content,
  });
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params.toString()}`;
};

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
