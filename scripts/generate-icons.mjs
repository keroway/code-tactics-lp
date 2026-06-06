// apple-touch-icon.png (180x180) を SVG から生成して public/ に出力する。
// 実行: node scripts/generate-icons.mjs (npm run icons)
// iOS ホーム画面はアイコンを自動で角丸にするため、ここでは角丸なし・不透明の
// フルブリード背景にする。配色は favicon.svg / og.png と統一 (accent = emerald-400)。
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "apple-touch-icon.png");

const S = 180;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="#0b1222"/>
  <g fill="none" stroke="#34d399" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="56,56 90,90 56,124"/>
    <line x1="102" y1="124" x2="136" y2="124"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`Wrote ${out}`);
