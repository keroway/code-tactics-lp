// @ts-check
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  // 検査対象外
  {
    ignores: ["dist/**", "node_modules/**", ".astro/**"],
  },

  // TypeScript 推奨ルール
  ...tseslint.configs.recommended,

  // Astro 推奨ルール
  ...eslintPluginAstro.configs.recommended,
];
