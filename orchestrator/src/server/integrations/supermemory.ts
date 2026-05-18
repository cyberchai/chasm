/**
 * Supermemory Integration — Persistent Business Knowledge Graph
 *
 * Stores and retrieves merchant business profiles, conversation history,
 * and product catalogs in Supermemory's graph memory engine.
 * This gives the merchant-ops agent persistent, evolving context
 * about each business — so when a customer calls, the agent knows
 * the merchant's hours, products, and preferences.
 *
 * SDK: supermemory  |  Docs: https://supermemory.ai/docs
 * API: https://api.supermemory.ai/v3/documents
 */

import Supermemory from "supermemory";
import { getEnv, type EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";

let _client: Supermemory | null = null;

/**
 * Lazily create a Supermemory client.
 */
function getClient(env: EnvSource = process.env, log: ChasmLogger = logger): Supermemory | null {
  const apiKey = getEnv("SUPERMEMORY_API_KEY", env);
  if (!apiKey) {
    log.info("SUPERMEMORY_API_KEY not set — Supermemory disabled.");
    return null;
  }

  if (_client) return _client;

  _client = new Supermemory({ apiKey });
  log.info("Supermemory client initialized.");
  return _client;
}

/**
 * Ingest a merchant's full business profile into Supermemory.
 * This becomes the persistent knowledge base the ops agent queries.
 */
export async function ingestBusinessProfile(
  merchantId: string,
  profile: {
    name: string;
    type: string;
    description: string;
    products: Array<{ name: string; price: number; description?: string }>;
    contact: { phone: string; address: string; hours: string };
    vibe: string[];
  },
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{ success: boolean; documentId?: string }> {
  const client = getClient(env, log);
  if (!client) return { success: false };

  try {
    // Build a rich text representation of the business
    const productList = profile.products
      .map((p) => `- ${p.name}: $${(p.price / 100).toFixed(2)}${p.description ? ` — ${p.description}` : ""}`)
      .join("\n");

    const content = `
Business Profile: ${profile.name}
Type: ${profile.type}
Vibe: ${profile.vibe.join(", ")}

Description: ${profile.description}

Products & Services:
${productList}

Contact Information:
Phone: ${profile.contact.phone}
Address: ${profile.contact.address}
Hours: ${profile.contact.hours}
`.trim();

    log.info("Ingesting business profile into Supermemory", {
      merchantId,
      businessName: profile.name,
      productCount: profile.products.length,
    });

    const result = await client.add({
      content,
      containerTag: `merchant-${merchantId}`,
      metadata: {
        title: `${profile.name} — Business Profile`,
        description: `Full business profile for ${profile.name} (${profile.type})`,
      },
    });

    log.info("Business profile ingested into Supermemory", {
      documentId: result.id,
      status: result.status,
    });

    return { success: true, documentId: result.id };
  } catch (error) {
    log.error("Failed to ingest business profile into Supermemory", { error });
    return { success: false };
  }
}

/**
 * Store a conversation turn for long-term memory.
 * Each call/message exchange builds the merchant's evolving context.
 */
export async function storeConversation(
  merchantId: string,
  conversation: Array<{ role: string; content: string }>,
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{ success: boolean }> {
  const client = getClient(env, log);
  if (!client) return { success: false };

  try {
    const content = conversation
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    await client.add({
      content,
      containerTag: `merchant-${merchantId}`,
    });

    log.info("Conversation stored in Supermemory", { merchantId, turns: conversation.length });
    return { success: true };
  } catch (error) {
    log.error("Failed to store conversation in Supermemory", { error });
    return { success: false };
  }
}

/**
 * Retrieve merchant context for the ops agent.
 * Returns the merchant's profile + relevant memories for answering
 * a customer's question.
 */
export async function getMerchantContext(
  merchantId: string,
  customerQuery: string,
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{
  context: string;
  profile: { static: string[]; dynamic: string[] };
}> {
  const client = getClient(env, log);
  if (!client) {
    return { context: "", profile: { static: [], dynamic: [] } };
  }

  try {
    const result = await client.profile({
      containerTag: `merchant-${merchantId}`,
      q: customerQuery,
    });

    const staticFacts = result.profile.static || [];
    const dynamicFacts = result.profile.dynamic || [];
    const memories = ((result.searchResults?.results || []) as any[])
      .map((r) => (r.memory as string) || "")
      .filter(Boolean);

    const context = [
      "=== Business Profile (Static) ===",
      ...staticFacts,
      "",
      "=== Recent Context (Dynamic) ===",
      ...dynamicFacts,
      "",
      "=== Relevant Memories ===",
      ...memories,
    ].join("\n");

    log.info("Retrieved merchant context from Supermemory", {
      merchantId,
      staticFactCount: staticFacts.length,
      dynamicFactCount: dynamicFacts.length,
      memoryCount: memories.length,
    });

    return {
      context,
      profile: { static: staticFacts, dynamic: dynamicFacts },
    };
  } catch (error) {
    log.error("Failed to retrieve merchant context from Supermemory", { error });
    return { context: "", profile: { static: [], dynamic: [] } };
  }
}
