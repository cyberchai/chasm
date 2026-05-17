import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, relative } from "node:path";
import type { BusinessProfile, EditResult } from "../../shared/types.js";
import { DEFAULT_TEMPLATE_DIR, siteDir, profilePath } from "./paths.js";
import { gitInit } from "./git.js";
import { startSite, DEFAULT_VITE_PORT } from "./siteProcess.js";
import { profileToContentSource } from "./profileToContent.js";

const exec = promisify(execFile);

export interface BuildInitialOptions {
  /** Template to clone. Defaults to the repo's /template (P3's). */
  templateDir?: string;
  vitePort?: number;
  /** Skip `npm install` — useful in tests when deps are already present. */
  skipInstall?: boolean;
  /** Skip starting the Vite dev server. */
  skipVite?: boolean;
  /**
   * Keep the template's own `src/content.ts` instead of generating it from the
   * profile. The template ships a typecheck-clean, richly-shaped `content.ts`;
   * `profileToContentSource` only emits the bare profile and will not satisfy
   * the current template's components. Set this so the initial site is always
   * build-green and let `applyEdit` customise it.
   */
  keepTemplateContent?: boolean;
}

/**
 * First build for a business — deterministic, no LLM call.
 * Clones the template, fills `src/content.ts` from the profile, installs deps,
 * git-inits the site, and starts the Vite dev server.
 */
export async function buildInitialSite(
  businessId: string,
  opts: BuildInitialOptions = {},
): Promise<EditResult> {
  const template = opts.templateDir ?? DEFAULT_TEMPLATE_DIR;
  const dest = siteDir(businessId);

  try {
    if (!existsSync(template)) {
      return {
        ok: false,
        summary: "",
        committed: false,
        error: `template not found at ${template}`,
      };
    }

    // 1. read the business profile
    const profile = JSON.parse(
      await readFile(profilePath(businessId), "utf8"),
    ) as BusinessProfile;

    // 2. fresh clone of the template (skip node_modules / .git)
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await cp(template, dest, {
      recursive: true,
      filter: (src) => {
        const rel = relative(template, src);
        return (
          rel === "" ||
          (!rel.startsWith("node_modules") && !rel.startsWith(".git"))
        );
      },
    });

    // 3. generate src/content.ts from the profile — unless the caller asked to
    //    keep the template's own (typecheck-clean) content.ts.
    if (!opts.keepTemplateContent) {
      await writeFile(
        join(dest, "src", "content.ts"),
        profileToContentSource(profile),
        "utf8",
      );
    }

    // 4. install deps (the template ships a .gitignore for node_modules)
    if (!opts.skipInstall) {
      await exec("npm", ["install", "--no-audit", "--no-fund"], {
        cwd: dest,
        timeout: 300_000,
      });
    }

    // 5. git repo for the site — commit-per-edit safety net
    await gitInit(dest);

    // 6. start the dev server
    if (!opts.skipVite) {
      startSite(businessId, dest, opts.vitePort ?? DEFAULT_VITE_PORT);
    }

    return {
      ok: true,
      summary: `Built the first version of the ${profile.type} site for ${profile.name}.`,
      committed: true,
    };
  } catch (e) {
    return {
      ok: false,
      summary: "",
      committed: false,
      error: (e as Error).message,
    };
  }
}
