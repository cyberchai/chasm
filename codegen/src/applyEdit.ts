import { existsSync } from "node:fs";
import type { EditRequest, EditResult } from "../../shared/types.js";
import { siteDir } from "./paths.js";
import { runEditAgent } from "./agent.js";
import { buildCheck } from "./buildCheck.js";
import { commitAll, revert } from "./git.js";
import { enqueue } from "./queue.js";

/**
 * Apply one voice/whiteboard instruction to a business's site.
 * Serialised per business — see queue.ts.
 */
export function applyEdit(req: EditRequest): Promise<EditResult> {
  return enqueue(req.businessId, () => applyEditNow(req));
}

async function applyEditNow(req: EditRequest): Promise<EditResult> {
  const cwd = siteDir(req.businessId);

  if (!existsSync(cwd)) {
    return {
      ok: false,
      summary: "",
      committed: false,
      error: `no site for "${req.businessId}" — run buildInitialSite first`,
    };
  }

  try {
    const summary = await runEditAgent({
      cwd,
      instruction: req.instruction,
      whiteboardPng: req.whiteboardPng,
      currentScreenshot: req.currentScreenshot,
    });

    // Build-safety gate: typecheck, revert if the edit broke the site.
    const check = await buildCheck(cwd);
    if (!check.ok) {
      await revert(cwd);
      return {
        ok: false,
        summary: "",
        committed: false,
        error: `edit reverted — build failed: ${check.error}`,
      };
    }

    const committed = await commitAll(cwd, `edit: ${req.instruction.slice(0, 60)}`);
    return { ok: true, summary, committed };
  } catch (e) {
    await revert(cwd).catch(() => undefined);
    return {
      ok: false,
      summary: "",
      committed: false,
      error: (e as Error).message,
    };
  }
}
