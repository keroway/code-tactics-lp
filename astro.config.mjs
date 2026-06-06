// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages (https://keroway.github.io/code-tactics-lp/) でのサブパス配信に合わせ
// site / base を設定。base を誤ると内部リンク・アセットパスが壊れるため必須。
// 内部リンクは import.meta.env.BASE_URL を前置して組み立てること。
// sitemap は site + base から URL を生成する (dist/sitemap-index.xml)。
export default defineConfig({
  site: "https://keroway.github.io",
  base: "/code-tactics-lp",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
