import { getEnv, requireEnv, type EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";
import {
  processBuilderCommand as defaultProcessBuilderCommand,
  type ProcessBuilderCommandOptions,
} from "../chasm/processBuilderCommand.js";
import type { ChasmBuilderResult } from "../chasm/builderCommands.js";
import {
  getAgentPhoneNumberId,
  isAgentPhoneTextChannel,
  normalizeAgentPhoneEvent,
} from "./normalize.js";
import {
  defaultAgentPhoneWebhookIdempotencyStore,
  type AgentPhoneWebhookIdempotencyStore,
} from "./idempotency.js";
import {
  sendAgentPhoneMessage as defaultSendAgentPhoneMessage,
  sendTypingIndicator as defaultSendTypingIndicator,
  type SendAgentPhoneMessageInput,
} from "./client.js";
import type { ChasmBuilderCommand } from "./types.js";
import { verifyAgentPhoneWebhook } from "./verify.js";

export type HeaderBag = Headers | Record<string, string | string[] | undefined>;

export type AgentPhoneWebhookResponse = {
  status: number;
  headers: Record<string, string>;
  body: string | AsyncIterable<string>;
};

export type BuilderCommandProcessor = (
  command: ChasmBuilderCommand,
  options?: ProcessBuilderCommandOptions,
) => Promise<ChasmBuilderResult>;

export type AgentPhoneWebhookHandlerOptions = {
  env?: EnvSource;
  idempotencyStore?: AgentPhoneWebhookIdempotencyStore;
  logger?: ChasmLogger;
  nowMs?: number;
  processBuilderCommand?: BuilderCommandProcessor;
  sendMessage?: (input: SendAgentPhoneMessageInput) => Promise<unknown>;
  sendTypingIndicator?: (input: { conversationId: string; env?: EnvSource; logger?: ChasmLogger }) => Promise<void>;
  webhookSecret?: string;
};

export async function handleAgentPhoneWebhookRequest({
  headers,
  rawBody,
  options = {},
}: {
  headers: HeaderBag;
  rawBody: string;
  options?: AgentPhoneWebhookHandlerOptions;
}): Promise<AgentPhoneWebhookResponse> {
  const env = options.env ?? process.env;
  const log = options.logger ?? logger;
  const signature = getHeader(headers, "x-webhook-signature");
  const timestamp = getHeader(headers, "x-webhook-timestamp");
  const eventId = getHeader(headers, "x-webhook-id");

  if (!signature || !timestamp || !eventId) {
    return textResponse(400, "Missing AgentPhone webhook headers");
  }

  let webhookSecret: string;

  try {
    webhookSecret = options.webhookSecret ?? requireEnv("AGENTPHONE_WEBHOOK_SECRET", env);
  } catch (error) {
    log.error("AgentPhone webhook secret is not configured", error);
    return textResponse(500, "Webhook secret is not configured");
  }

  const isVerified = verifyAgentPhoneWebhook({
    nowMs: options.nowMs,
    rawBody,
    secret: webhookSecret,
    signature,
    timestamp,
  });

  if (!isVerified) {
    return textResponse(401, "Invalid AgentPhone webhook signature");
  }

  const idempotencyStore = options.idempotencyStore ?? defaultAgentPhoneWebhookIdempotencyStore;
  const isFirstDelivery = await idempotencyStore.claim(eventId);

  if (!isFirstDelivery) {
    log.info("Duplicate AgentPhone webhook ignored", { eventId });
    return textResponse(200, "OK");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return textResponse(400, "Invalid JSON");
  }

  return routeVerifiedAgentPhoneEvent({
    env,
    eventId,
    log,
    options,
    payload,
  });
}

function routeVerifiedAgentPhoneEvent({
  env,
  eventId,
  log,
  options,
  payload,
}: {
  env: EnvSource;
  eventId: string;
  log: ChasmLogger;
  options: AgentPhoneWebhookHandlerOptions;
  payload: unknown;
}): AgentPhoneWebhookResponse {
  const event = stringField(payload, "event");
  const channel = stringField(payload, "channel");

  if (event === "agent.message" && isAgentPhoneTextChannel(channel)) {
    const command = normalizeAgentPhoneEvent(payload, eventId);

    if (!command) {
      return textResponse(202, "Ignored");
    }

    runInBackground(
      () => processTextBuilderCommand(command, getAgentPhoneNumberId(payload), options, env, log),
      log,
    );

    return textResponse(200, "OK");
  }

  if (event === "agent.message" && channel === "voice") {
    const command = normalizeAgentPhoneEvent(payload, eventId);

    if (!command) {
      return textResponse(202, "Ignored");
    }

    return {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: voiceResponseStream(command, options, env, log),
    };
  }

  if (event === "agent.call_ended") {
    logCallEnded(payload, eventId, log);
    return textResponse(200, "OK");
  }

  if (event === "agent.reaction") {
    logReaction(payload, eventId, log);
    return textResponse(200, "OK");
  }

  log.info("AgentPhone webhook event ignored", { channel, event, eventId });
  return textResponse(200, "OK");
}

async function processTextBuilderCommand(
  command: ChasmBuilderCommand,
  numberId: string | undefined,
  options: AgentPhoneWebhookHandlerOptions,
  env: EnvSource,
  log: ChasmLogger,
): Promise<void> {
  const sendMessage = options.sendMessage ?? defaultSendAgentPhoneMessage;
  const sendTypingIndicator = options.sendTypingIndicator ?? defaultSendTypingIndicator;

  if (command.sessionId) {
    try {
      await sendTypingIndicator({ conversationId: command.sessionId, env, logger: log });
    } catch (error) {
      log.warn("AgentPhone typing indicator skipped", error);
    }
  }

  try {
    await sendMessage({
      body: "Got it — Chasm is updating the site now.",
      env,
      numberId,
      toNumber: command.fromNumber,
    });
  } catch (error) {
    log.error("Failed to send AgentPhone builder acknowledgement", error);
  }

  const result = await processCommand(command, options, env, log);
  const body = finalTextMessage(result);

  try {
    await sendMessage({
      body,
      env,
      numberId,
      toNumber: command.fromNumber,
    });
  } catch (error) {
    log.error("Failed to send AgentPhone builder completion message", error);
  }
}

async function* voiceResponseStream(
  command: ChasmBuilderCommand,
  options: AgentPhoneWebhookHandlerOptions,
  env: EnvSource,
  log: ChasmLogger,
): AsyncIterable<string> {
  yield `${JSON.stringify({ text: "Got it — Chasm is updating the site now.", interim: true })}\n`;

  runInBackground(
    () => processCommand(command, options, env, log),
    log,
  );

  // Leading space: AgentPhone concatenates the interim and final chunks, so
  // without it the two sentences run together ("now.Keep going").
  yield `${JSON.stringify({ text: " Keep going and tell me the next change." })}\n`;
}

async function processCommand(
  command: ChasmBuilderCommand,
  options: AgentPhoneWebhookHandlerOptions,
  env: EnvSource,
  log: ChasmLogger,
): Promise<ChasmBuilderResult> {
  const processor = options.processBuilderCommand ?? defaultProcessBuilderCommand;
  return processor(command, { env, logger: log });
}

function finalTextMessage(result: ChasmBuilderResult): string {
  if (result.status === "failed") {
    const reason = result.summary ? `: ${result.summary}` : ".";
    return `I hit an issue updating the site${reason}\nReply with the change again and I will retry.`;
  }

  // result.summary is codegen's real description of what changed.
  const base = result.summary?.trim() || "Done — I updated the preview.";
  return result.previewUrl ? `${base}\n${result.previewUrl}` : base;
}

function logCallEnded(payload: unknown, eventId: string, log: ChasmLogger): void {
  const data = recordField(payload, "data");

  log.info("AgentPhone call ended", {
    callId: stringField(data, "callId"),
    callSuccessful: data.callSuccessful,
    durationSeconds: data.durationSeconds,
    eventId,
    sentiment: stringField(data, "userSentiment"),
    status: stringField(data, "status"),
    summary: stringField(data, "summary"),
    transcript: data.transcript,
  });
}

function logReaction(payload: unknown, eventId: string, log: ChasmLogger): void {
  const data = recordField(payload, "data");

  log.info("AgentPhone iMessage reaction received", {
    eventId,
    messageId: stringField(data, "messageId"),
    reactionType: stringField(data, "reactionType"),
    sessionId: stringField(data, "conversationId"),
  });
}

function runInBackground(task: () => Promise<void> | Promise<unknown>, log: ChasmLogger): void {
  void Promise.resolve()
    .then(task)
    .catch((error) => {
      log.error("AgentPhone background task failed", error);
    });
}

function textResponse(status: number, body: string): AgentPhoneWebhookResponse {
  return {
    body,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status,
  };
}

function getHeader(headers: HeaderBag, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

  if (Array.isArray(direct)) {
    return direct[0];
  }

  if (direct !== undefined) {
    return direct;
  }

  const lowerName = name.toLowerCase();
  const foundKey = Object.keys(headers).find((key) => key.toLowerCase() === lowerName);
  const foundValue = foundKey ? headers[foundKey] : undefined;

  return Array.isArray(foundValue) ? foundValue[0] : foundValue;
}

function stringField(value: unknown, key: string): string {
  const record = recordValue(value);
  const field = record[key];
  return typeof field === "string" ? field : "";
}

function recordField(value: unknown, key: string): Record<string, unknown> {
  return recordValue(recordValue(value)[key]);
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
