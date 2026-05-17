import type { ChasmBuilderCommand } from "../agentphone/types.js";
import { appendPath, getEnv, type EnvSource } from "../env.js";

export type ChasmBuilderResult = {
  status: "queued" | "completed" | "failed";
  summary: string;
  previewUrl?: string;
  projectId?: string;
};

export function inferProjectId(command: ChasmBuilderCommand): string {
  const phoneDigits = command.fromNumber.replace(/\D/g, "");

  if (phoneDigits) {
    return `phone-${phoneDigits.slice(-10)}`;
  }

  const sessionSlug = command.sessionId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return sessionSlug ? `session-${sessionSlug}` : "demo";
}

export function previewUrlForProject(projectId: string, env: EnvSource = process.env): string | undefined {
  const baseUrl = getEnv("CHASM_PREVIEW_BASE_URL", env);
  return baseUrl ? appendPath(baseUrl, `/p/${projectId}`) : undefined;
}
