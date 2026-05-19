import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServerResponse } from "node:http";
import { applyEdit, buildInitialSite, dataDir, profilePath, siteDir } from "@chasm/codegen";
import { captureSite } from "../../../infra/screenshot.js";
import type { WhiteboardSubmission } from "../../../shared/types.js";
import { logger } from "./logger.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** The live site URL handed back to the whiteboard once a build finishes. */
const SITE_URL = "http://localhost:5173";

export const WHITEBOARD_ENDPOINTS = new Set([
  "/api/profile",
  "/api/screenshot",
  "/webhook/whiteboard",
]);

export function sendWhiteboardPreflight(response: ServerResponse): void {
  response.writeHead(204, CORS_HEADERS);
  response.end();
}

export async function sendProfile(response: ServerResponse, businessId: string): Promise<void> {
  if (!isSafeBusinessId(businessId)) {
    sendJson(response, 400, { error: "Invalid business id" });
    return;
  }

  const file = profilePath(businessId);
  if (!existsSync(file)) {
    sendJson(response, 404, { error: `No profile for "${businessId}"` });
    return;
  }

  response.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(await readFile(file, "utf8"));
}

export async function sendScreenshot(response: ServerResponse, businessId: string): Promise<void> {
  if (!isSafeBusinessId(businessId)) {
    sendJson(response, 400, { error: "Invalid business id" });
    return;
  }

  try {
    const file = await captureOrLatestScreenshot(businessId);
    const png = await readFile(file);
    response.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    response.end(png);
  } catch (error) {
    logger.error("Failed to serve whiteboard screenshot", { businessId, error });
    sendJson(response, 503, {
      error: "Unable to capture site screenshot",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function receiveWhiteboard(rawBody: string, response: ServerResponse): Promise<void> {
  let body: WhiteboardSubmission;
  try {
    body = JSON.parse(rawBody) as WhiteboardSubmission;
  } catch {
    sendJson(response, 400, { error: "Invalid JSON" });
    return;
  }

  if (!isSafeBusinessId(body.businessId)) {
    sendJson(response, 400, { error: "Invalid business id" });
    return;
  }
  if (typeof body.pngBase64 !== "string" || body.pngBase64.length === 0) {
    sendJson(response, 400, { error: "pngBase64 is required" });
    return;
  }

  const dir = join(dataDir(body.businessId), "whiteboard");
  await mkdir(dir, { recursive: true });
  const whiteboardPng = join(dir, `whiteboard-${Date.now()}.png`);
  await writeFile(whiteboardPng, dataUrlToBuffer(body.pngBase64));

  // Build synchronously — the whiteboard holds this request open, shows
  // "building…", and gets the site URL back once the build finishes.
  const result = await applyWhiteboardEdit(body.businessId, whiteboardPng);

  if (!result.ok) {
    sendJson(response, 500, { ok: false, error: result.error ?? "Whiteboard build failed" });
    return;
  }

  sendJson(response, 200, { ok: true, url: SITE_URL, summary: result.summary });
}

async function applyWhiteboardEdit(
  businessId: string,
  whiteboardPng: string,
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  try {
    // Whiteboard-first: with no site yet, stand up a baseline to build onto.
    if (!existsSync(siteDir(businessId))) {
      logger.info("No site yet — building a baseline before the whiteboard build", { businessId });
      await ensureBaselineSite(businessId);
    }

    const result = await applyEdit({
      businessId,
      instruction:
        "The attached whiteboard image is the owner's hand-drawn design for " +
        "their website — a from-scratch design mockup, not annotations on an " +
        "existing page. Rebuild the site to match it on two levels:\n" +
        "1. LAYOUT — the same sections in the same top-to-bottom order, with " +
        "matching headings, copy blocks, and overall structure.\n" +
        "2. STYLE — read the drawing's semantic cues and apply them. Capture " +
        "the colour palette (colours actually drawn, colours named in labels, " +
        "or the palette implied by the sketch's mood and the kind of " +
        "business), the typography (heading weight, serif vs sans, casing, " +
        "letter-spacing), and the spacing/formatting feel. If the sketch is " +
        "monochrome, infer a palette that fits its style. Apply this by " +
        "editing src/content.ts `colors`, src/theme.ts, and component Tailwind " +
        "classes so the rendered site genuinely reflects that look.\n" +
        "Keep the build green — it must typecheck with no broken imports.",
      whiteboardPng,
    });

    if (!result.ok) {
      logger.error("Whiteboard build failed", { businessId, error: result.error });
      return { ok: false, error: result.error };
    }

    logger.info("Whiteboard build applied", {
      businessId,
      committed: result.committed,
      summary: result.summary,
    });
    return { ok: true, summary: result.summary };
  } catch (error) {
    logger.error("Whiteboard build crashed", { businessId, error });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Stand up a typecheck-clean baseline site for the whiteboard design to build onto. */
async function ensureBaselineSite(businessId: string): Promise<void> {
  await mkdir(dataDir(businessId), { recursive: true });
  if (!existsSync(profilePath(businessId))) {
    await writeFile(
      profilePath(businessId),
      JSON.stringify(
        {
          businessId,
          name: "New Business",
          type: "shop",
          vibe: [],
          colors: [],
          tagline: "",
          products: [],
          contact: { phone: "", address: "", hours: "" },
          sections: ["hero", "products", "about", "contact", "order"],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  const built = await buildInitialSite(businessId, { preset: "florist" });
  if (!built.ok) {
    throw new Error(built.error ?? "baseline build failed");
  }
}

async function captureOrLatestScreenshot(businessId: string): Promise<string> {
  try {
    return await captureSite(businessId);
  } catch (error) {
    const latest = await latestScreenshotPath(businessId);
    if (latest) {
      logger.warn("Using latest screenshot after capture failed", { businessId, error });
      return latest;
    }
    throw error;
  }
}

async function latestScreenshotPath(businessId: string): Promise<string | null> {
  const dir = join(dataDir(businessId), "screenshots");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    names
      .filter((name) => name.endsWith(".png"))
      .map(async (name) => {
        const file = join(dir, name);
        return { file, mtimeMs: (await stat(file)).mtimeMs };
      }),
  );
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.file ?? null;
}

function sendJson(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function dataUrlToBuffer(value: string): Buffer {
  const base64 = value.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

function isSafeBusinessId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}
