import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAgentPhoneEvent } from "../../orchestrator/src/server/agentphone/normalize.js";

const fixtureDir = join(process.cwd(), "test/fixtures/agentphone");

describe("normalizeAgentPhoneEvent", () => {
  it("normalizes sms payloads into Chasm builder commands", () => {
    const command = normalizeAgentPhoneEvent(readFixture("sms-message.json"), "evt_sms");

    expect(command).toMatchObject({
      agentId: "agt_chasm",
      channel: "sms",
      eventId: "evt_sms",
      fromNumber: "+15551234567",
      mediaUrls: [],
      sessionId: "conv_sms_123",
      source: "agentphone",
      text: "Make the hero darker green.",
      toNumber: "+15557654321",
    });
  });

  it("normalizes imessage payloads into Chasm builder commands", () => {
    const command = normalizeAgentPhoneEvent(readFixture("imessage-message.json"), "evt_imessage");

    expect(command).toMatchObject({
      channel: "imessage",
      eventId: "evt_imessage",
      mediaUrls: ["https://example.com/product.png"],
      sessionId: "conv_imessage_123",
      text: "Add this product photo to the bouquets section.",
    });
  });

  it("normalizes voice payloads into Chasm builder commands", () => {
    const command = normalizeAgentPhoneEvent(readFixture("voice-message.json"), "evt_voice");

    expect(command).toMatchObject({
      channel: "voice",
      eventId: "evt_voice",
      mediaUrls: [],
      sessionId: "call_voice_123",
      text: "Make the site feel more premium.",
    });
  });

  it("does not normalize call-ended payloads as builder commands", () => {
    expect(normalizeAgentPhoneEvent(readFixture("call-ended.json"), "evt_call_ended")).toBeNull();
  });
});

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8")) as unknown;
}
