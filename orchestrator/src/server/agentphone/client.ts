import { AgentPhoneClient } from "agentphone";
import type { AgentPhone } from "agentphone";
import { getEnv, requireEnv, type EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";

const AGENTPHONE_API_BASE_URL = "https://api.agentphone.ai/v1";

let cachedClient: AgentPhoneClient | null = null;
let cachedToken: string | null = null;

export type AgentPhoneSendStyle =
  | "celebration"
  | "fireworks"
  | "lasers"
  | "love"
  | "confetti"
  | "balloons"
  | "spotlight"
  | "echo"
  | "invisible"
  | "gentle"
  | "loud"
  | "slam";

export type SendAgentPhoneMessageInput = {
  toNumber: string;
  body: string;
  mediaUrls?: string[];
  numberId?: string;
  sendStyle?: AgentPhoneSendStyle;
  env?: EnvSource;
};

export type SendTypingIndicatorInput = {
  conversationId: string;
  env?: EnvSource;
  logger?: ChasmLogger;
};

export type ChasmAgentConfig = {
  agentId?: string;
  agentName?: string;
  description?: string;
  beginMessage?: string;
  env?: EnvSource;
};

export type AgentPhoneNumberRef = {
  id: string;
  phoneNumber?: string;
  status?: string;
  reused?: boolean;
  raw?: unknown;
};

export type ProvisionNumberInput = {
  numberId?: string;
  areaCode?: string;
  agentId?: string;
  env?: EnvSource;
};

export type AgentPhoneWebhookConfig = {
  agentId: string;
  url: string;
  contextLimit?: number;
  timeout?: number;
  env?: EnvSource;
};

export type ProjectWebhookConfig = Omit<AgentPhoneWebhookConfig, "agentId">;

export function getAgentPhoneClient(env: EnvSource = process.env): AgentPhoneClient {
  const token = requireEnv("AGENTPHONE_API_KEY", env);

  if (!cachedClient || cachedToken !== token) {
    cachedToken = token;
    cachedClient = new AgentPhoneClient({ token });
  }

  return cachedClient;
}

export async function sendAgentPhoneMessage({
  toNumber,
  body,
  mediaUrls,
  numberId,
  sendStyle,
  env = process.env,
}: SendAgentPhoneMessageInput): Promise<AgentPhone.SendMessageResponse> {
  const agentId = requireEnv("AGENTPHONE_AGENT_ID", env);
  const request = {
    agent_id: agentId,
    to_number: toNumber,
    body,
    media_urls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
    number_id: numberId ?? getEnv("AGENTPHONE_NUMBER_ID", env),
    send_style: sendStyle,
  } satisfies AgentPhone.SendMessageRequest;

  const client = getAgentPhoneClient(env);

  if (typeof client.messages?.sendMessage === "function") {
    return client.messages.sendMessage(request);
  }

  return agentphoneFetch<AgentPhone.SendMessageResponse>("/messages", {
    body: request,
    env,
    method: "POST",
  });
}

export async function sendTypingIndicator({
  conversationId,
  env = process.env,
  logger: log = logger,
}: SendTypingIndicatorInput): Promise<void> {
  const client = getAgentPhoneClient(env);

  if (typeof client.conversations?.sendTypingIndicator !== "function") {
    log.info("AgentPhone SDK does not expose typing indicators; skipping.");
    return;
  }

  try {
    await client.conversations.sendTypingIndicator({ conversation_id: conversationId });
  } catch (error) {
    log.warn("AgentPhone typing indicator failed", error);
  }
}

export async function createOrUpdateChasmAgent({
  agentId,
  agentName = "Chasm",
  description = "Chasm is an on-the-fly AI website builder controlled by text, iMessage, SMS, MMS, and voice calls.",
  beginMessage = "Hey, this is Chasm. Tell me what you want to build or change on your site.",
  env = process.env,
}: ChasmAgentConfig): Promise<AgentPhone.AgentResponse> {
  const client = getAgentPhoneClient(env);
  const basePayload = {
    name: agentName,
    description,
    voiceMode: "webhook" as const,
    beginMessage,
    enableMessaging: true,
  };

  if (agentId) {
    const request = { agent_id: agentId, ...basePayload } satisfies AgentPhone.UpdateAgentRequest;

    if (typeof client.agents?.updateAgent === "function") {
      return client.agents.updateAgent(request);
    }

    return agentphoneFetch<AgentPhone.AgentResponse>(`/agents/${agentId}`, {
      body: basePayload,
      env,
      method: "PATCH",
    });
  }

  const request = basePayload satisfies AgentPhone.CreateAgentRequest;

  if (typeof client.agents?.createAgent === "function") {
    return client.agents.createAgent(request);
  }

  return agentphoneFetch<AgentPhone.AgentResponse>("/agents", {
    body: request,
    env,
    method: "POST",
  });
}

export async function provisionOrUseNumber({
  numberId,
  areaCode,
  agentId,
  env = process.env,
}: ProvisionNumberInput): Promise<AgentPhoneNumberRef> {
  if (numberId) {
    return { id: numberId, reused: true };
  }

  const client = getAgentPhoneClient(env);
  const request = {
    country: "US",
    areaCode: areaCode || undefined,
    agentId: agentId || undefined,
  } satisfies AgentPhone.CreateNumberRequest;

  const number =
    typeof client.numbers?.createNumber === "function"
      ? await client.numbers.createNumber(request)
      : await agentphoneFetch<AgentPhone.PhoneNumberResponse>("/numbers", {
          body: request,
          env,
          method: "POST",
        });

  return {
    id: number.id,
    phoneNumber: number.phoneNumber,
    status: number.status,
    raw: number,
  };
}

export async function attachNumberToAgent({
  agentId,
  numberId,
  env = process.env,
}: {
  agentId: string;
  numberId: string;
  env?: EnvSource;
}): Promise<AgentPhone.AttachNumberResponse> {
  const client = getAgentPhoneClient(env);
  const request = { agent_id: agentId, numberId } satisfies AgentPhone.AttachNumberRequest;

  if (typeof client.agents?.attachNumberToAgent === "function") {
    return client.agents.attachNumberToAgent(request);
  }

  return agentphoneFetch<AgentPhone.AttachNumberResponse>(`/agents/${agentId}/numbers`, {
    body: { numberId },
    env,
    method: "POST",
  });
}

export async function createOrUpdateAgentWebhook({
  agentId,
  url,
  contextLimit = 10,
  timeout = 60,
  env = process.env,
}: AgentPhoneWebhookConfig): Promise<AgentPhone.WebhookResponse> {
  const client = getAgentPhoneClient(env);
  const body = { url, contextLimit, timeout };
  const request = { agent_id: agentId, body } satisfies AgentPhone.CreateOrUpdateAgentWebhookV1AgentsAgentIdWebhookPostRequest;

  if (typeof client.agentWebhooks?.createOrUpdateAgentWebhook === "function") {
    return client.agentWebhooks.createOrUpdateAgentWebhook(request);
  }

  return agentphoneFetch<AgentPhone.WebhookResponse>(`/agents/${agentId}/webhook`, {
    body,
    env,
    method: "POST",
  });
}

export async function createOrUpdateProjectWebhook({
  url,
  contextLimit = 10,
  timeout = 60,
  env = process.env,
}: ProjectWebhookConfig): Promise<AgentPhone.WebhookResponse> {
  const client = getAgentPhoneClient(env);
  const request = { url, contextLimit, timeout } satisfies AgentPhone.WebhookCreateRequest;

  if (typeof client.webhooks?.createOrUpdateWebhook === "function") {
    return client.webhooks.createOrUpdateWebhook(request);
  }

  return agentphoneFetch<AgentPhone.WebhookResponse>("/webhooks", {
    body: request,
    env,
    method: "POST",
  });
}

async function agentphoneFetch<T>(
  path: string,
  {
    body,
    env,
    method,
  }: {
    body?: unknown;
    env: EnvSource;
    method: "DELETE" | "GET" | "PATCH" | "POST";
  },
): Promise<T> {
  const response = await fetch(`${AGENTPHONE_API_BASE_URL}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${requireEnv("AGENTPHONE_API_KEY", env)}`,
      "Content-Type": "application/json",
    },
    method,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AgentPhone ${method} ${path} failed (${response.status}): ${errorBody}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
