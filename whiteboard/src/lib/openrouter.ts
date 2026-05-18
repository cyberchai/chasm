import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loadedRootEnv = false;

export function getOpenRouterApiKey(): string | undefined {
  loadRootEnvIfNeeded();
  return process.env.OPENROUTER_API_KEY;
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export async function callOpenRouter(body: object): Promise<Response> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
      "X-Title": "Whiteboard App",
    },
    body: JSON.stringify(body),
  });
}

function loadRootEnvIfNeeded(): void {
  if (loadedRootEnv || process.env.OPENROUTER_API_KEY) return;
  loadedRootEnv = true;

  for (const file of envCandidates()) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed && process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
    if (process.env.OPENROUTER_API_KEY) return;
  }
}

function envCandidates(): string[] {
  return [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
  if (!match) return null;

  const [, key, rawValue] = match;
  let value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}
