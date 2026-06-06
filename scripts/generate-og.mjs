// OGP 画像 (1200x630) を SVG から生成して public/og.png に出力する。
// 実行: node scripts/generate-og.mjs
// フォント環境差を避けるため、テキストはラテン文字 + 等幅のみで構成する。
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "og.png");

const W = 1200;
const H = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="1" stop-color="#0b1222"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#1e293b" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.5"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#34d399"/>

  <text x="80" y="150" font-family="monospace" font-size="22" letter-spacing="6" fill="#34d399">PROGRAMMABLE AUTO-BATTLE</text>

  <text x="76" y="300" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#f1f5f9">code-tactics</text>

  <text x="80" y="372" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#cbd5e1">Build the AI. Watch it fight. Read the log. Fix it.</text>

  <g font-family="monospace" font-size="22" fill="#64748b">
    <rect x="80" y="436" width="1040" height="118" rx="10" fill="#0f172a" stroke="#1e293b"/>
    <text x="104" y="476" fill="#94a3b8">tick=120 unit=TankA rule=2 condition=enemy_in_range action=<tspan fill="#34d399">attack</tspan></text>
    <text x="104" y="508" fill="#94a3b8">tick=121 unit=TankB event=damaged from=TankA damage=10 hp=70</text>
    <text x="104" y="540" fill="#94a3b8">tick=450 unit=TankB event=<tspan fill="#f87171">destroyed</tspan></text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`Wrote ${out}`);
