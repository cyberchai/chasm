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
import { getEnv } from "../env.js";
import { ingestBusinessProfile, storeConversation, logMerchantPayout } from "../integrations/index.js";
import { logger, type ChasmLogger } from "../logger.js";
import {
  inferProjectId,
  previewUrlForProject,
  type ChasmBuilderResult,
} from "./builderCommands.js";

export type ProcessBuilderCommandOptions = {
  env?: EnvSource;
  logger?: ChasmLogger;
};

/** One business for the demo — see docs/CONTRACTS.md. */
const BUSINESS_ID = "demo";

/** Starting templates the owner can be matched into — see template/src/presets/. */
const PRESETS = ["florist", "cafe", "tech"] as const;
type Preset = (typeof PRESETS)[number];

/** Pick the closest starting template from the owner's first message. */
function pickPreset(text: string): Preset {
  const t = text.toLowerCase();
  if (/\b(caf[eé]|coffee|restaurant|bakery|bistro|diner|brunch|menu|eatery|kitchen)\b/.test(t)) {
    return "cafe";
  }
  if (/\b(tech|startup|software|saas|app|ai|platform|developer|product|launch|api)\b/.test(t)) {
    return "tech";
  }
  return "florist";
}

/** Seed profile — only feeds the build summary; the preset drives site content. */
function seedProfile(preset: Preset): BusinessProfile {
  return {
    businessId: BUSINESS_ID,
    name: "New Business",
    type: preset,
    vibe: [],
    colors: [],
    tagline: "",
    products: [],
    contact: { phone: "", address: "", hours: "" },
    sections: ["hero", "products", "about", "contact", "order"],
  };
}

/** Initial build runs at most once; concurrent commands await the same build. */
let buildOnce: Promise<EditResult> | null = null;

function ensureSiteBuilt(preset: Preset, log: ChasmLogger): Promise<EditResult> {
  if (!buildOnce) {
    buildOnce = (async () => {
      await mkdir(dataDir(BUSINESS_ID), { recursive: true });
      if (!existsSync(profilePath(BUSINESS_ID))) {
        await writeFile(
          profilePath(BUSINESS_ID),
          JSON.stringify(seedProfile(preset), null, 2),
          "utf8",
        );
      }
      log.info("Building initial site from preset (clones template, installs deps)", {
        businessId: BUSINESS_ID,
        preset,
      });
      const result = await buildInitialSite(BUSINESS_ID, { preset });
      log.info("Initial site build finished", { ok: result.ok, error: result.error });
      return result;
    })();
  }
  return buildOnce;
}

/** Gemini multimodal analysis for iMessage product photos. */
async function analyzeMediaWithGemini(
  mediaUrl: string,
  apiKey: string,
  log: ChasmLogger,
): Promise<string> {
  try {
    log.info("Fetching media for Gemini multimodal analysis", { mediaUrl });
    const res = await fetch(mediaUrl);
    if (!res.ok) throw new Error(`Failed to fetch media: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    log.info("Invoking Gemini (gemini-2.5-flash) for product curation...");
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "You are Chasm AI, a world-class retail curator. Analyze this product image from a merchant. Identify the product name, describe its aesthetic in one sentence, and suggest a fair retail price in USD (e.g. $45.00). Keep output concise.",
                },
                {
                  inlineData: {
                    mimeType: res.headers.get("content-type") || "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${geminiRes.status} ${errText}`);
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Analyzed item: Custom Product ($45.00)";
    log.info("Gemini analysis complete", { analysis: text.trim() });
    return text.trim();
  } catch (error) {
    log.error("Gemini multimodal analysis failed", { error });
    return "Custom product ($45.00)";
  }
}

/**
 * Turn one normalized AgentPhone command into a real site edit.
 *
 * First contact triggers a deterministic initial build; every command after
 * that runs the Claude Agent SDK edit loop in `codegen`.
 */
export async function processBuilderCommand(
  command: ChasmBuilderCommand,
  { env = process.env, logger: log = logger }: ProcessBuilderCommandOptions = {},
): Promise<ChasmBuilderResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    delete process.env.ANTHROPIC_API_KEY;
  }

  const projectId = inferProjectId(command);
  const previewUrl = previewUrlForProject(BUSINESS_ID, env);

  log.info("Chasm builder command received", {
    channel: command.channel,
    eventId: command.eventId,
    mediaCount: command.mediaUrls.length,
    businessId: BUSINESS_ID,
    projectId,
    sessionId: command.sessionId,
    text: truncate(command.text),
  });

  let geminiAnalysis = "";
  const geminiKey = getEnv("GEMINI_API_KEY", env);
  if (command.mediaUrls.length > 0 && geminiKey) {
    geminiAnalysis = await analyzeMediaWithGemini(command.mediaUrls[0], geminiKey, log);
  }

  storeConversation(
    projectId,
    [
      { role: "merchant", content: command.text },
      ...(geminiAnalysis ? [{ role: "assistant", content: `Gemini analysis: ${geminiAnalysis}` }] : []),
    ],
    env,
    log,
  ).catch((err) => log.error("Background Supermemory store failed", { error: err }));

  const instruction = command.text.trim();
  if (!instruction && !geminiAnalysis) {
    return {
      status: "completed",
      summary:
        command.mediaUrls.length > 0
          ? "Got your photo — say what to do with it."
          : "Tell me what to build or change on your site.",
      committed: false,
      previewUrl,
      projectId: BUSINESS_ID,
    };
  }

  const editInstruction =
    instruction ||
    (geminiAnalysis ? `Add this product to the site based on the analysis: ${geminiAnalysis}` : "");

  if (!existsSync(siteDir(BUSINESS_ID))) {
    const preset = pickPreset(editInstruction);
    log.info("Selected starting template", { preset, businessId: BUSINESS_ID });
    const built = await ensureSiteBuilt(preset, log);
    if (!built.ok) {
      return {
        status: "failed",
        summary: built.error ?? "I couldn't build the initial site.",
        committed: false,
        previewUrl,
        projectId: BUSINESS_ID,
      };
    }

    ingestBusinessProfile(
      projectId,
      {
        name: "New Business",
        type: preset,
        description: editInstruction,
        products: [],
        contact: { phone: "", address: "", hours: "" },
        vibe: [],
      },
      env,
      log,
    ).catch((err) => log.error("Background Supermemory ingest failed", { error: err }));
  }

  const result = await applyEdit({ businessId: BUSINESS_ID, instruction: editInstruction });

  log.info("Chasm edit finished", {
    ok: result.ok,
    committed: result.committed,
    error: result.error,
  });

  if (result.ok) {
    logMerchantPayout(projectId, "0.00", env, log).catch((err) =>
      log.error("Background Sponge payout log failed", { error: err }),
    );
  }

  const summary = result.ok
    ? geminiAnalysis
      ? `${result.summary} (Photo: ${geminiAnalysis})`
      : result.summary
    : result.error ?? "The edit didn't go through.";

  return {
    status: result.ok ? "completed" : "failed",
    summary,
    committed: result.ok && result.committed,
    previewUrl,
    projectId: BUSINESS_ID,
  };
}

function truncate(value: string, maxLength = 160): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
