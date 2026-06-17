// OGP 画像 (1200x630) を実ゲーム画面に SVG オーバーレイを重ねて public/og.png に出力する。
// 実行: node scripts/generate-og.mjs
// フォント環境差を避けるため、テキストはラテン文字 + 等幅のみで構成する。
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshot = join(
  __dirname,
  "..",
  "src",
  "assets",
  "game-screenshot.png",
);
const out = join(__dirname, "..", "public", "og.png");

const W = 1200;
const H = 630;

// 実プレイ画面を 1200x630 にカバーフィット (上端揃え) で敷く。
// ツールバー + バトルフィールド上部 + ガンビット (ルール) 編集 UI 上部が収まる。
const background = await sharp(screenshot)
  .resize({ width: W, height: H, fit: "cover", position: "top" })
  .toBuffer();

// 左側を強めに暗転させてキャッチコピーを可読化しつつ、右側 (ガンビット編集 UI) は
// 透過させて「ルールを組んで戦わせる」という本作の主張をビジュアルで残す。
const overlay = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#020617" stop-opacity="0.95"/>
      <stop offset="0.62" stop-color="#020617" stop-opacity="0.88"/>
      <stop offset="0.88" stop-color="#020617" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#leftFade)"/>
  <rect width="${W}" height="${H}" fill="url(#bottomFade)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#34d399"/>

  <text x="80" y="170" font-family="monospace" font-size="22" letter-spacing="6" fill="#34d399">PROGRAMMABLE AUTO-BATTLE</text>

  <text x="76" y="320" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#f1f5f9">code-tactics</text>

  <text x="80" y="392" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#cbd5e1">Build the AI. Watch it fight. Read the log. Fix it.</text>
</svg>`;

await sharp(background)
  .composite([{ input: Buffer.from(overlay) }])
  .png({ compressionLevel: 9 })
  .toFile(out);
console.log(`Wrote ${out}`);
