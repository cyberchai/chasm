export type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type ChasmEnvName =
  | "AGENTPHONE_API_KEY"
  | "AGENTPHONE_AGENT_ID"
  | "AGENTPHONE_NUMBER_ID"
  | "AGENTPHONE_WEBHOOK_SECRET"
  | "AGENTPHONE_WEBHOOK_URL"
  | "AGENTPHONE_AREA_CODE"
  | "CHASM_PUBLIC_APP_URL"
  | "CHASM_PREVIEW_BASE_URL"
  | "GEMINI_API_KEY";

export function getEnv(name: ChasmEnvName, env: EnvSource = process.env): string | undefined {
  const value = env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function requireEnv(name: ChasmEnvName, env: EnvSource = process.env): string {
  const value = getEnv(name, env);

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function appendPath(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
