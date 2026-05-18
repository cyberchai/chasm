import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { handleAgentPhoneWebhookRequest } from "./agentphone/webhook.js";
import { getWalletStatus } from "./integrations/sponge.js";
import { logger } from "./logger.js";
import {
  WHITEBOARD_ENDPOINTS,
  receiveWhiteboard,
  sendProfile,
  sendScreenshot,
  sendWhiteboardPreflight,
} from "./whiteboard.js";

const AGENTPHONE_WEBHOOK_PATHS = new Set([
  "/api/agentphone/webhook",
  "/webhook/agentphone/call",
  "/webhook/agentphone/imessage",
]);
const PORT = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS" && WHITEBOARD_ENDPOINTS.has(url.pathname)) {
    sendWhiteboardPreflight(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "chasm-orchestrator" }));
    return;
  }

  // Sponge Wallet status endpoint — show agent wallet during demo
  if (request.method === "GET" && url.pathname === "/api/wallet/status") {
    try {
      const status = await getWalletStatus();
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(status, null, 2));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Failed to fetch wallet status" }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/profile") {
    await sendProfile(response, url.searchParams.get("b") ?? "demo");
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/screenshot") {
    await sendScreenshot(response, url.searchParams.get("b") ?? "demo");
    return;
  }

  if (request.method === "POST" && url.pathname === "/webhook/whiteboard") {
    await receiveWhiteboard(await readRawBody(request), response);
    return;
  }

  if (request.method === "POST" && AGENTPHONE_WEBHOOK_PATHS.has(url.pathname)) {
    const rawBody = await readRawBody(request);
    const handlerResponse = await handleAgentPhoneWebhookRequest({
      headers: request.headers,
      rawBody,
    });

    await sendHandlerResponse(response, handlerResponse.status, handlerResponse.headers, handlerResponse.body);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

server.listen(PORT, () => {
  logger.info(`Chasm orchestrator listening on http://localhost:${PORT}`);
  logger.info("Endpoints:");
  logger.info("  GET  /health                 — health check");
  logger.info("  GET  /api/wallet/status       — Sponge wallet status");
  logger.info("  GET  /api/profile             — current business profile");
  logger.info("  GET  /api/screenshot          — current site screenshot");
  logger.info("  POST /webhook/whiteboard      — whiteboard PNG submissions");
  logger.info("  POST /api/agentphone/webhook  — AgentPhone webhooks");
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use. Stop the old orchestrator before running npm run dev.`);
    process.exitCode = 1;
    return;
  }
  logger.error(error);
});

async function readRawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function sendHandlerResponse(
  response: ServerResponse,
  status: number,
  headers: Record<string, string>,
  body: string | AsyncIterable<string>,
): Promise<void> {
  response.writeHead(status, headers);

  if (typeof body === "string") {
    response.end(body);
    return;
  }

  for await (const chunk of body) {
    response.write(chunk);
  }

  response.end();
}
