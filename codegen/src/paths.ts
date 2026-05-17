import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root — codegen/src/../.. */
export const REPO_ROOT = resolve(here, "..", "..");

/** The shared base website. Cloned per business by buildInitialSite. */
export const DEFAULT_TEMPLATE_DIR = join(REPO_ROOT, "template");

/** codegen/prompts/edit-agent.md — the edit agent's system prompt. */
export const EDIT_AGENT_PROMPT = join(REPO_ROOT, "codegen", "prompts", "edit-agent.md");

export const dataDir = (businessId: string): string =>
  join(REPO_ROOT, "data", businessId);

export const siteDir = (businessId: string): string =>
  join(REPO_ROOT, "sites", businessId);

export const profilePath = (businessId: string): string =>
  join(dataDir(businessId), "profile.json");
