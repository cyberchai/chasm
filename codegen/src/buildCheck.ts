import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface BuildCheckResult {
  ok: boolean;
  error?: string;
}

/**
 * Typecheck the site — the safety gate after every edit.
 * Runs `tsc --noEmit` against the site's own tsconfig. Fast (~1-3s).
 * On failure the caller reverts the edit.
 */
export async function buildCheck(cwd: string): Promise<BuildCheckResult> {
  try {
    await exec("npx", ["--no-install", "tsc", "--noEmit"], {
      cwd,
      timeout: 120_000,
    });
    return { ok: true };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    return { ok: false, error: out || err.message || "typecheck failed" };
  }
}
