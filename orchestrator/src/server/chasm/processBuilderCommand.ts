import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import {
  applyEdit,
  buildInitialSite,
  dataDir,
  profilePath,
  siteDir,
  type BusinessProfile,
  type EditResult,
} from "@chasm/codegen";
import type { ChasmBuilderCommand } from "../agentphone/types.js";
import type { EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";
import { previewUrlForProject, type ChasmBuilderResult } from "./builderCommands.js";

export type ProcessBuilderCommandOptions = {
  env?: EnvSource;
  logger?: ChasmLogger;
};

/** One business for the demo — see docs/CONTRACTS.md. */
const BUSINESS_ID = "demo";

/**
 * Seed profile for the first build. The initial site keeps the template's own
 * typecheck-clean `content.ts` (see `keepTemplateContent` below), so this
 * profile only feeds the build summary — the owner's instructions reshape the
 * actual site. It mirrors the template default for a coherent first message.
 */
const DEFAULT_PROFILE: BusinessProfile = {
  businessId: BUSINESS_ID,
  name: "Rose & Thorn",
  type: "florist",
  vibe: ["cozy", "modern", "artisanal"],
  colors: ["#2d5016", "#f5f0e1"],
  tagline: "Fresh arrangements, made daily",
  products: [],
  contact: { phone: "", address: "", hours: "" },
  sections: ["hero", "products", "about", "contact", "order"],
};

/** Initial build runs at most once; concurrent commands await the same build. */
let buildOnce: Promise<EditResult> | null = null;

function ensureSiteBuilt(log: ChasmLogger): Promise<EditResult> {
  if (!buildOnce) {
    buildOnce = (async () => {
      await mkdir(dataDir(BUSINESS_ID), { recursive: true });
      if (!existsSync(profilePath(BUSINESS_ID))) {
        await writeFile(
          profilePath(BUSINESS_ID),
          JSON.stringify(DEFAULT_PROFILE, null, 2),
          "utf8",
        );
      }
      log.info("Building initial site (this clones the template and installs deps)", {
        businessId: BUSINESS_ID,
      });
      const result = await buildInitialSite(BUSINESS_ID, { keepTemplateContent: true });
      log.info("Initial site build finished", { ok: result.ok, error: result.error });
      return result;
    })();
  }
  return buildOnce;
}

/**
 * Turn one normalized AgentPhone command into a real site edit.
 *
 * First contact triggers a deterministic initial build; every command after
 * that runs the Claude Agent SDK edit loop in `codegen`. The returned
 * `summary` is the real, human-readable description of what changed — the
 * orchestrator speaks/texts it back to the owner.
 */
export async function processBuilderCommand(
  command: ChasmBuilderCommand,
  { env = process.env, logger: log = logger }: ProcessBuilderCommandOptions = {},
): Promise<ChasmBuilderResult> {
  // codegen's Agent SDK authenticates with the Claude subscription. An empty
  // ANTHROPIC_API_KEY would be treated as a (bad) API key, so drop it.
  if (!process.env.ANTHROPIC_API_KEY) {
    delete process.env.ANTHROPIC_API_KEY;
  }

  const previewUrl = previewUrlForProject(BUSINESS_ID, env);

  log.info("Chasm builder command received", {
    channel: command.channel,
    eventId: command.eventId,
    mediaCount: command.mediaUrls.length,
    businessId: BUSINESS_ID,
    sessionId: command.sessionId,
    text: truncate(command.text),
  });

  const instruction = command.text.trim();
  if (!instruction) {
    return {
      status: "completed",
      summary:
        command.mediaUrls.length > 0
          ? "Got your photo — texted product images aren't wired into codegen yet."
          : "Tell me what to build or change on your site.",
      previewUrl,
      projectId: BUSINESS_ID,
    };
  }

  // 1. First contact → deterministic initial build (clone template, no LLM).
  if (!existsSync(siteDir(BUSINESS_ID))) {
    const built = await ensureSiteBuilt(log);
    if (!built.ok) {
      return {
        status: "failed",
        summary: built.error ?? "I couldn't build the initial site.",
        previewUrl,
        projectId: BUSINESS_ID,
      };
    }
  }

  // 2. Apply the instruction with the Claude Agent SDK edit loop.
  const result = await applyEdit({ businessId: BUSINESS_ID, instruction });

  log.info("Chasm edit finished", {
    ok: result.ok,
    committed: result.committed,
    error: result.error,
  });

  return {
    status: result.ok ? "completed" : "failed",
    summary: result.ok
      ? result.summary
      : result.error ?? "The edit didn't go through.",
    previewUrl,
    projectId: BUSINESS_ID,
  };
}

function truncate(value: string, maxLength = 160): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
