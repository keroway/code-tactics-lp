import { readdir } from "node:fs/promises";
import { join } from "node:path";

// dist/ 以下の .html を再帰的に走査する。REPO_IS_PUBLIC ゲートと hero 動画ゲートの
// 共用ヘルパ。呼び出し側は for await (const file of walkHtml(dist)) で消費する。
export async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(path);
    } else if (entry.name.endsWith(".html")) {
      yield path;
    }
  }
}
