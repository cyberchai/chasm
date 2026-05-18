/**
 * Moss Integration — Sub-10ms Real-time Semantic Search
 *
 * Moss provides lightning-fast (<10ms) semantic search for the
 * merchant-ops agent. When a customer calls with a question like
 * "Do you do same-day delivery?", Moss instantly retrieves the
 * most relevant answer from the merchant's indexed knowledge base
 * — without round-tripping to a vector database.
 *
 * This is the retrieval layer that makes the voice agent feel
 * conversational instead of robotic. Following the architecture
 * from the Moss x AgentPhone cookbook:
 *   https://github.com/usemoss/moss/tree/main/examples/cookbook/agentphone
 *
 * SDK: @moss-dev/moss  |  Docs: https://docs.moss.dev/docs
 */

import { MossClient, type DocumentInfo } from "@moss-dev/moss";
import { getEnv, type EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";

let _client: MossClient | null = null;

/**
 * Lazily create a MossClient.
 */
function getClient(env: EnvSource = process.env, log: ChasmLogger = logger): MossClient | null {
  const projectId = getEnv("MOSS_PROJECT_ID", env);
  const projectKey = getEnv("MOSS_PROJECT_KEY", env);

  if (!projectId || !projectKey) {
    log.info("MOSS_PROJECT_ID or MOSS_PROJECT_KEY not set — Moss disabled.");
    return null;
  }

  if (_client) return _client;

  _client = new MossClient(projectId, projectKey);
  log.info("Moss client initialized.", { projectId });
  return _client;
}

/**
 * Create and populate a Moss index for a merchant's business knowledge.
 * This is called once during onboarding (Act I) to seed the index
 * with FAQs, products, policies, and contact info.
 *
 * The index name follows the pattern: `merchant-{merchantId}`
 */
export async function createMerchantIndex(
  merchantId: string,
  businessData: {
    name: string;
    type: string;
    description: string;
    products: Array<{ name: string; price: number; description?: string }>;
    contact: { phone: string; address: string; hours: string };
    faqs?: Array<{ question: string; answer: string }>;
  },
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{ success: boolean; indexName: string }> {
  const client = getClient(env, log);
  const indexName = `merchant-${merchantId}`;

  if (!client) return { success: false, indexName };

  try {
    // Build documents from the business data
    const documents: DocumentInfo[] = [];

    // Business overview
    documents.push({
      id: `${merchantId}-overview`,
      text: `${businessData.name} is a ${businessData.type}. ${businessData.description}`,
      metadata: { category: "overview", merchantId },
    });

    // Contact info
    documents.push({
      id: `${merchantId}-contact`,
      text: `Contact ${businessData.name}: Phone ${businessData.contact.phone}. Address: ${businessData.contact.address}. Hours: ${businessData.contact.hours}.`,
      metadata: { category: "contact", merchantId },
    });

    // Products
    businessData.products.forEach((product, i) => {
      documents.push({
        id: `${merchantId}-product-${i}`,
        text: `${product.name}: $${(product.price / 100).toFixed(2)}. ${product.description || ""}`,
        metadata: { category: "product", merchantId, productName: product.name },
      });
    });

    // FAQs (if provided, or generate defaults for a florist)
    const faqs = businessData.faqs || getDefaultFAQs(businessData.name, businessData.type);
    faqs.forEach((faq, i) => {
      documents.push({
        id: `${merchantId}-faq-${i}`,
        text: `Q: ${faq.question} A: ${faq.answer}`,
        metadata: { category: "faq", merchantId },
      });
    });

    log.info("Creating Moss index for merchant", {
      indexName,
      documentCount: documents.length,
      businessName: businessData.name,
    });

    await client.createIndex(indexName, documents, { modelId: "moss-minilm" });
    await client.loadIndex(indexName);

    log.info("Moss index created and loaded successfully", { indexName });
    return { success: true, indexName };
  } catch (error) {
    log.error("Failed to create Moss index", { error, indexName });
    return { success: false, indexName };
  }
}

/**
 * Search the merchant's knowledge base in <10ms.
 * This is the core retrieval function called by the merchant-ops
 * agent when a customer asks a question over the phone.
 *
 * Returns the top-K most semantically relevant documents.
 */
export async function searchMerchantKnowledge(
  merchantId: string,
  query: string,
  options: { topK?: number; alpha?: number } = {},
  env: EnvSource = process.env,
  log: ChasmLogger = logger,
): Promise<{
  results: Array<{ id: string; text: string; score: number }>;
  searchTimeMs: number;
}> {
  const client = getClient(env, log);
  const indexName = `merchant-${merchantId}`;

  if (!client) {
    return { results: [], searchTimeMs: 0 };
  }

  try {
    const startTime = performance.now();

    // Ensure index is loaded
    try {
      await client.loadIndex(indexName);
    } catch {
      // Index might already be loaded — continue
    }

    const searchResult = await client.query(indexName, query, {
      topK: options.topK ?? 5,
      alpha: options.alpha ?? 0.8, // Bias towards semantic similarity
    });

    const searchTimeMs = Math.round(performance.now() - startTime);

    const results = (searchResult.docs || []).map((doc: any) => ({
      id: doc.id || "",
      text: doc.text || "",
      score: doc.score || 0,
    }));

    log.info("Moss semantic search completed", {
      indexName,
      query: query.substring(0, 80),
      resultCount: results.length,
      searchTimeMs,
      topScore: results[0]?.score,
    });

    return { results, searchTimeMs };
  } catch (error) {
    log.error("Moss semantic search failed", { error, indexName, query });
    return { results: [], searchTimeMs: 0 };
  }
}

/**
 * Build context string from Moss search results for injection
 * into the LLM prompt. This mirrors the pattern from the
 * Moss x AgentPhone cookbook agent.py:
 *   context_str = "\n".join([f"- {d.text}" for d in results.docs])
 */
export function buildContextFromResults(
  results: Array<{ text: string; score: number }>,
  minScore = 0.3,
): string {
  const relevant = results.filter((r) => r.score >= minScore);
  if (relevant.length === 0) return "";

  return [
    "Relevant context from knowledge base:",
    ...relevant.map((r) => `- ${r.text}`),
    "",
    "Use this context to answer the user's question accurately.",
  ].join("\n");
}

/** Generate sensible default FAQs for common business types. */
function getDefaultFAQs(
  businessName: string,
  businessType: string,
): Array<{ question: string; answer: string }> {
  if (businessType === "florist") {
    return [
      {
        question: "Do you offer same-day delivery?",
        answer: `Yes! ${businessName} offers same-day delivery on orders placed before 2pm. A delivery fee of $12 applies within a 10-mile radius.`,
      },
      {
        question: "Can I customize a bouquet?",
        answer: `Absolutely. ${businessName} specializes in custom arrangements. Call us or visit the shop to discuss your vision, preferred flowers, and budget.`,
      },
      {
        question: "Do you do wedding flowers?",
        answer: `Yes, ${businessName} provides full wedding floral services including bridal bouquets, centerpieces, boutonnieres, and ceremony arrangements. We recommend booking at least 3 months in advance.`,
      },
      {
        question: "What is your return or refund policy?",
        answer: `If you're not satisfied with your arrangement, contact us within 24 hours of delivery and we'll make it right — either a replacement or a full refund.`,
      },
      {
        question: "Do you sell plants or dried flowers?",
        answer: `Yes! ${businessName} carries a selection of potted plants, succulents, and dried botanical arrangements that last for months.`,
      },
      {
        question: "What payment methods do you accept?",
        answer: `${businessName} accepts all major credit cards, Apple Pay, Google Pay, and cash. We also support online ordering through our website with Stripe checkout.`,
      },
    ];
  }

  // Generic defaults for any business type
  return [
    {
      question: `What are ${businessName}'s hours?`,
      answer: `Please check our website or call us for the most up-to-date hours.`,
    },
    {
      question: `Where is ${businessName} located?`,
      answer: `Visit our website for our full address and directions.`,
    },
  ];
}
