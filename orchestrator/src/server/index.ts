import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { handleAgentPhoneWebhookRequest } from "./agentphone/webhook.js";
import { logger } from "./logger.js";

const AGENTPHONE_WEBHOOK_PATHS = new Set([
  "/api/agentphone/webhook",
  "/webhook/agentphone/call",
  "/webhook/agentphone/imessage",
]);
const PORT = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "chasm-orchestrator" }));
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
