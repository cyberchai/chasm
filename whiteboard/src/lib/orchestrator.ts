export interface WhiteboardSubmitResult {
  ok: boolean;
  /** The live site URL — present once the build finishes. */
  url?: string;
  /** Human-readable summary of what the build produced. */
  summary?: string;
}

/**
 * Submit the final whiteboard PNG and wait for the build to finish. The
 * orchestrator holds the request open until codegen has rebuilt the site,
 * then returns the live URL.
 */
export async function submitFinalPng(
  businessId: string,
  pngBase64: string
): Promise<WhiteboardSubmitResult> {
  const orchestratorUrl =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3000";

  const res = await fetch(`${orchestratorUrl}/webhook/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, pngBase64 }),
  });

  const data = (await res.json().catch(() => ({}))) as WhiteboardSubmitResult & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Orchestrator returned ${res.status}`);
  }

  return { ok: data.ok ?? true, url: data.url, summary: data.summary };
}
