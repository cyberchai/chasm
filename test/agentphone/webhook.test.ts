import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryAgentPhoneWebhookIdempotencyStore } from "../../orchestrator/src/server/agentphone/idempotency.js";
import {
  handleAgentPhoneWebhookRequest,
  type AgentPhoneWebhookResponse,
} from "../../orchestrator/src/server/agentphone/webhook.js";

const secret = "whsec_test";
const fixtureDir = join(process.cwd(), "test/fixtures/agentphone");

describe("AgentPhone webhook handler", () => {
  it("does not process repeated X-Webhook-ID deliveries twice", async () => {
    const rawBody = readRawFixture("sms-message.json");
    const store = new InMemoryAgentPhoneWebhookIdempotencyStore();
    let processed = 0;

    const options = {
      idempotencyStore: store,
      processBuilderCommand: async () => {
        processed += 1;
        return { status: "completed" as const, summary: "ok" };
      },
      sendMessage: async () => undefined,
      sendTypingIndicator: async () => undefined,
      webhookSecret: secret,
    };

    await handleAgentPhoneWebhookRequest({
      headers: signedHeaders(rawBody, "wh_repeat"),
      options,
      rawBody,
    });
    await handleAgentPhoneWebhookRequest({
      headers: signedHeaders(rawBody, "wh_repeat"),
      options,
      rawBody,
    });

    await waitUntil(() => processed === 1);
    expect(processed).toBe(1);
  });

  it("returns 200 quickly for text messages", async () => {
    const rawBody = readRawFixture("sms-message.json");
    const startedAt = performance.now();

    const response = await handleAgentPhoneWebhookRequest({
      headers: signedHeaders(rawBody, "wh_sms"),
      options: {
        idempotencyStore: new InMemoryAgentPhoneWebhookIdempotencyStore(),
        processBuilderCommand: async () => {
          await sleep(100);
          return { status: "completed" as const, summary: "ok" };
        },
        sendMessage: async () => undefined,
        sendTypingIndicator: async () => undefined,
        webhookSecret: secret,
      },
      rawBody,
    });

    expect(response.status).toBe(200);
    expect(await collectBody(response)).toBe("OK");
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it("streams an interim and final NDJSON response for voice messages", async () => {
    const rawBody = readRawFixture("voice-message.json");
    const response = await handleAgentPhoneWebhookRequest({
      headers: signedHeaders(rawBody, "wh_voice"),
      options: {
        idempotencyStore: new InMemoryAgentPhoneWebhookIdempotencyStore(),
        processBuilderCommand: async () => ({ status: "completed" as const, summary: "ok" }),
        webhookSecret: secret,
      },
      rawBody,
    });

    const lines = (await collectBody(response))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { interim?: boolean; text: string });

    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/x-ndjson");
    expect(lines).toEqual([
      { text: "Got it. Chasm is updating the site now.", interim: true },
      { text: "I started that update. Keep going and tell me the next change." },
    ]);
  });
});

function readRawFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function signedHeaders(rawBody: string, eventId: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  return {
    "X-Webhook-Event": "agent.message",
    "X-Webhook-ID": eventId,
    "X-Webhook-Signature": `sha256=${digest}`,
    "X-Webhook-Timestamp": timestamp,
  };
}

async function collectBody(response: AgentPhoneWebhookResponse): Promise<string> {
  if (typeof response.body === "string") {
    return response.body;
  }

  let output = "";

  for await (const chunk of response.body) {
    output += chunk;
  }

  return output;
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 250;

  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for predicate");
    }

    await sleep(5);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
