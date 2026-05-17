export type AgentPhoneTextChannel = "sms" | "mms" | "imessage";
export type AgentPhoneChannel = AgentPhoneTextChannel | "voice";
export type AgentPhoneEventName = "agent.message" | "agent.call_ended" | "agent.reaction";

export type AgentPhoneRecentHistoryItem = {
  content: string;
  direction: "inbound" | "outbound";
  channel: string;
  at: string;
};

export type AgentPhoneMessageEvent = {
  event: "agent.message";
  channel: AgentPhoneChannel;
  timestamp: string;
  agentId: string;
  data: {
    conversationId?: string;
    callId?: string;
    numberId?: string;
    from: string;
    to: string;
    message?: string;
    mediaUrl?: string | null;
    mediaUrls?: string[] | null;
    transcript?: string;
    receivedAt?: string;
    direction?: "inbound" | "outbound";
    status?: string;
    confidence?: number;
  };
  conversationState?: Record<string, unknown> | null;
  recentHistory?: AgentPhoneRecentHistoryItem[];
};

export type AgentPhoneCallEndedEvent = {
  event: "agent.call_ended";
  channel: "voice";
  timestamp: string;
  agentId: string;
  data: {
    callId: string;
    numberId?: string;
    from: string;
    to: string;
    direction?: "inbound" | "outbound";
    status?: string;
    startedAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    disconnectionReason?: string;
    transcript?: unknown;
    summary?: string;
    userSentiment?: string;
    callSuccessful?: boolean;
  };
  conversationState?: Record<string, unknown> | null;
  recentHistory?: AgentPhoneRecentHistoryItem[];
};

export type AgentPhoneReactionEvent = {
  event: "agent.reaction";
  channel: "imessage";
  timestamp: string;
  agentId: string;
  data: {
    conversationId: string;
    numberId?: string;
    reactionType: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" | string;
    fromNumber: string;
    direction?: "inbound" | "outbound";
    messageId: string;
    messageBody?: string | null;
    messageMediaUrl?: string | null;
    createdAt?: string;
  };
};

export type AgentPhoneWebhookEvent =
  | AgentPhoneMessageEvent
  | AgentPhoneCallEndedEvent
  | AgentPhoneReactionEvent;

export type ChasmBuilderCommand = {
  source: "agentphone";
  eventId: string;
  agentId: string;
  sessionId: string;
  channel: AgentPhoneChannel;
  fromNumber: string;
  toNumber: string;
  text: string;
  mediaUrls: string[];
  receivedAt: string;
  conversationState?: Record<string, unknown> | null;
  recentHistory?: Array<{
    content: string;
    direction: "inbound" | "outbound";
    channel: string;
    at: string;
  }>;
  raw: unknown;
};
