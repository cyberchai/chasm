export async function submitFinalPng(
  businessId: string,
  pngBase64: string
): Promise<void> {
  const orchestratorUrl =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3000";

  const res = await fetch(`${orchestratorUrl}/webhook/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, pngBase64 }),
  });

  if (!res.ok) {
    throw new Error(`Orchestrator returned ${res.status}`);
  }
}
