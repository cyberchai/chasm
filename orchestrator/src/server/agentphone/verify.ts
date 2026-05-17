import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export type VerifyAgentPhoneWebhookInput = {
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string;
  nowMs?: number;
};

export function verifyAgentPhoneWebhook({
  rawBody,
  signature,
  timestamp,
  secret,
  nowMs = Date.now(),
}: VerifyAgentPhoneWebhookInput): boolean {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  const timestampMs = parseWebhookTimestamp(timestamp);

  if (timestampMs === null || Math.abs(nowMs - timestampMs) > WEBHOOK_TOLERANCE_MS) {
    return false;
  }

  const receivedDigest = signature.trim().startsWith("sha256=")
    ? signature.trim().slice("sha256=".length)
    : "";

  if (!/^[a-fA-F0-9]{64}$/.test(receivedDigest)) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedDigest = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expected = Buffer.from(expectedDigest, "hex");
  const received = Buffer.from(receivedDigest, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

function parseWebhookTimestamp(timestamp: string): number | null {
  const parsed = Number(timestamp);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}
