import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * フィクスチャディレクトリを cwd にしてゲートスクリプトをサブプロセスとして
 * 実行する。各スクリプトは DIST_DIR 等を定数で持ち process.exit するため、
 * import してユニットテストするより cwd 切り替えでブラックボックス実行する
 * 方が対象スクリプト自体への変更が要らない。
 */
export function runScript(scriptPath, { cwd, env = {}, unset = [] } = {}) {
  const fullEnv = { ...process.env, ...env };
  for (const key of unset) delete fullEnv[key];
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: fullEnv,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// テストごとに使い捨ての一時ディレクトリを用意し、後始末を保証する。
export async function withTmpDir(prefix, fn) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
