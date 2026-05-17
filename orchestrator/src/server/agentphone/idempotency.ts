export interface AgentPhoneWebhookIdempotencyStore {
  claim(eventId: string): Promise<boolean>;
}

export class InMemoryAgentPhoneWebhookIdempotencyStore implements AgentPhoneWebhookIdempotencyStore {
  private readonly seenAtByEventId = new Map<string, number>();

  // TODO: replace this with durable storage before Chasm handles non-localhost traffic.
  constructor(private readonly ttlMs = 60 * 60 * 1000) {}

  async claim(eventId: string): Promise<boolean> {
    this.cleanup();

    if (this.seenAtByEventId.has(eventId)) {
      return false;
    }

    this.seenAtByEventId.set(eventId, Date.now());
    return true;
  }

  clear(): void {
    this.seenAtByEventId.clear();
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.ttlMs;

    for (const [eventId, seenAt] of this.seenAtByEventId.entries()) {
      if (seenAt < cutoff) {
        this.seenAtByEventId.delete(eventId);
      }
    }
  }
}

export const defaultAgentPhoneWebhookIdempotencyStore =
  new InMemoryAgentPhoneWebhookIdempotencyStore();
