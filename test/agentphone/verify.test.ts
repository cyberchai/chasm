import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyAgentPhoneWebhook } from "../../orchestrator/src/server/agentphone/verify.js";

const secret = "whsec_test";
const rawBody = JSON.stringify({ event: "agent.message", channel: "sms" });

describe("verifyAgentPhoneWebhook", () => {
  it("accepts a valid signature", () => {
    const timestamp = "1789585200";
    const signature = sign(timestamp, rawBody);

    expect(
      verifyAgentPhoneWebhook({
        nowMs: Number(timestamp) * 1000,
        rawBody,
        secret,
        signature,
        timestamp,
      }),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const timestamp = "1789585200";

    expect(
      verifyAgentPhoneWebhook({
        nowMs: Number(timestamp) * 1000,
        rawBody,
        secret,
        signature: "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        timestamp,
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const timestamp = "1789585200";
    const signature = sign(timestamp, rawBody);

    expect(
      verifyAgentPhoneWebhook({
        nowMs: (Number(timestamp) + 301) * 1000,
        rawBody,
        secret,
        signature,
        timestamp,
      }),
    ).toBe(false);
  });
});

function sign(timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
