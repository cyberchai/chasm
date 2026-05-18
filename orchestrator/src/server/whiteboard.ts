import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServerResponse } from "node:http";
import { applyEdit, dataDir, profilePath } from "@chasm/codegen";
import { captureSite } from "../../../infra/screenshot.js";
import type { WhiteboardSubmission } from "../../../shared/types.js";
import { logger } from "./logger.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

  void applyWhiteboardEdit(body.businessId, whiteboardPng);

  sendJson(response, 202, { ok: true, queued: true });
}

async function applyWhiteboardEdit(businessId: string, whiteboardPng: string): Promise<void> {
  try {
    const currentScreenshot = await captureOrLatestScreenshot(businessId).catch((error) => {
      logger.warn("Continuing whiteboard edit without current screenshot", { businessId, error });
      return undefined;
    });

    const result = await applyEdit({
      businessId,
      instruction: "see whiteboard",
      whiteboardPng,
      currentScreenshot,
    });

    if (!result.ok) {
      logger.error("Whiteboard edit failed", { businessId, error: result.error });
      return;
    }

    logger.info("Whiteboard edit applied", {
      businessId,
      committed: result.committed,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("Whiteboard edit crashed", { businessId, error });
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
