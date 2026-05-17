import type {
  AgentPhoneChannel,
  AgentPhoneRecentHistoryItem,
  AgentPhoneTextChannel,
  AgentPhoneWebhookEvent,
  ChasmBuilderCommand,
} from "./types.js";

const TEXT_CHANNELS = new Set<AgentPhoneTextChannel>(["sms", "mms", "imessage"]);
const ALL_CHANNELS = new Set<AgentPhoneChannel>(["sms", "mms", "imessage", "voice"]);

export function normalizeAgentPhoneEvent(
  event: AgentPhoneWebhookEvent | unknown,
  eventId: string,
): ChasmBuilderCommand | null {
  const envelope = asRecord(event);

  if (stringField(envelope, "event") !== "agent.message") {
    return null;
  }

  const channel = stringField(envelope, "channel");

  if (!isAgentPhoneChannel(channel)) {
    return null;
  }

  const data = asRecord(envelope.data);
  const agentId = stringField(envelope, "agentId") || stringField(envelope, "agent_id");
  const timestamp = stringField(envelope, "timestamp") || new Date().toISOString();

  if (channel === "voice") {
    return {
      source: "agentphone",
      eventId,
      agentId,
      sessionId: stringField(data, "callId") || stringField(data, "call_id"),
      channel,
      fromNumber: stringField(data, "from"),
      toNumber: stringField(data, "to"),
      text: stringField(data, "transcript"),
      mediaUrls: [],
      receivedAt: stringField(data, "receivedAt") || timestamp,
      conversationState: conversationState(envelope),
      recentHistory: recentHistory(envelope.recentHistory),
      raw: event,
    };
  }

  if (TEXT_CHANNELS.has(channel)) {
    return {
      source: "agentphone",
      eventId,
      agentId,
      sessionId: stringField(data, "conversationId") || stringField(data, "conversation_id"),
      channel,
      fromNumber: stringField(data, "from"),
      toNumber: stringField(data, "to"),
      text: stringField(data, "message"),
      mediaUrls: mediaUrls(data),
      receivedAt: stringField(data, "receivedAt") || timestamp,
      conversationState: conversationState(envelope),
      recentHistory: recentHistory(envelope.recentHistory),
      raw: event,
    };
  }

  return null;
}

export function isAgentPhoneTextChannel(channel: unknown): channel is AgentPhoneTextChannel {
  return typeof channel === "string" && TEXT_CHANNELS.has(channel as AgentPhoneTextChannel);
}

export function isAgentPhoneChannel(channel: unknown): channel is AgentPhoneChannel {
  return typeof channel === "string" && ALL_CHANNELS.has(channel as AgentPhoneChannel);
}

export function getAgentPhoneNumberId(event: unknown): string | undefined {
  const data = asRecord(asRecord(event).data);
  return stringField(data, "numberId") || stringField(data, "number_id") || undefined;
}

function mediaUrls(data: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  const singular = stringField(data, "mediaUrl") || stringField(data, "media_url");
  const plural = data.mediaUrls ?? data.media_urls;

  if (singular) {
    urls.add(singular);
  }

  if (Array.isArray(plural)) {
    for (const item of plural) {
      if (typeof item === "string" && item.trim()) {
        urls.add(item.trim());
      }
    }
  }

  return [...urls];
}

function conversationState(envelope: Record<string, unknown>): Record<string, unknown> | null {
  if (envelope.conversationState === null || envelope.conversationState === undefined) {
    return null;
  }

  return asRecord(envelope.conversationState);
}

function recentHistory(value: unknown): AgentPhoneRecentHistoryItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      const direction = stringField(record, "direction");

      if (direction !== "inbound" && direction !== "outbound") {
        return null;
      }

      return {
        content: stringField(record, "content"),
        direction,
        channel: stringField(record, "channel"),
        at: stringField(record, "at"),
      };
    })
    .filter((item): item is AgentPhoneRecentHistoryItem => item !== null);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
