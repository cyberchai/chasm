import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";

function buildPrompt(userPrompt: string): string {
  return `You are helping design a website mockup. The user has drawn a wireframe.
CRITICAL:
- Make ONLY the minimum change needed to fulfill the instruction. Do not improve, redraw, or touch anything else.
- DO NOT remove, modify, move, or touch ANY existing content in the image.
- Modify ONLY the exact region where the change is needed — leave all other pixels identical.
- Draw all additions in a clean wireframe style.
- Keep the background pure white.
- Match the user's sketchy/wireframe aesthetic.
- If the requested change is small, the output should look almost identical to the input except for that one change.
Additional instruction: ${userPrompt}`;
}

// Tries every known structure OpenRouter/Gemini uses to return an image.
// Mirrors the extraction logic from the Collaboard reference implementation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(message: Record<string, any>): string | null {
  // Format 1: message.images array — image_url.url OR url at top level
  const legacyImages = message?.images;
  if (Array.isArray(legacyImages) && legacyImages.length > 0) {
    const found = legacyImages[0]?.image_url?.url ?? legacyImages[0]?.url ?? null;
    if (found) return found;
  }

  // Format 2: content array — image_url or output_image blocks
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === "image_url" && part.image_url?.url) {
        return part.image_url.url;
      }
      if (part?.type === "output_image" && (part.url || part.image_url?.url)) {
        return part.url ?? part.image_url?.url;
      }
    }
  }

  // Format 3: string content — scan for data URL or https image URL
  if (typeof message.content === "string") {
    const dataUrlMatch = message.content.match(
      /data:image\/[a-zA-Z+]+;base64,[^\s")']+/
    );
    const httpUrlMatch = message.content.match(
      /https?:\/\/[^\s")']+?\.(?:png|jpg|jpeg|gif|webp)/i
    );
    return dataUrlMatch?.[0] ?? httpUrlMatch?.[0] ?? null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { image, prompt } = await req.json();

    const res = await callOpenRouter({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: buildPrompt(prompt) },
          ],
        },
      ],
      modalities: ["image", "text"],
      reasoning_effort: "minimal",
    });

    const rawText = await res.text();
    console.log("[suggest] status:", res.status);

    if (!res.ok) {
      console.error("[suggest] OpenRouter error:", rawText);
      return NextResponse.json(
        { imageUrl: null, textContent: rawText, _raw: rawText },
        { status: 502 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[suggest] JSON parse failed:", rawText.slice(0, 500));
      return NextResponse.json(
        { imageUrl: null, textContent: rawText, _raw: rawText },
        { status: 502 }
      );
    }

    const message = data?.choices?.[0]?.message ?? {};
    // Log message structure without dumping the full base64 payload
    const imagesInfo = Array.isArray(message.images)
      ? message.images.map((img: Record<string, unknown>) => ({
          keys: Object.keys(img),
          urlPreview: (img.url as string)?.slice(0, 40),
          imageUrlPreview: (img as { image_url?: { url?: string } }).image_url?.url?.slice(0, 40),
        }))
      : null;
    const contentInfo = Array.isArray(message.content)
      ? message.content.map((b: { type: string }) => b.type)
      : typeof message.content;
    console.log("[suggest] message keys:", Object.keys(message));
    console.log("[suggest] images:", imagesInfo);
    console.log("[suggest] content:", contentInfo);

    const imageUrl = extractImageUrl(message);
    console.log("[suggest] imageUrl extracted:", imageUrl ? imageUrl.slice(0, 60) + "…" : null);

    const textContent =
      Array.isArray(message.content)
        ? message.content.find((b: { type: string }) => b.type === "text")?.text ?? ""
        : message.content ?? "";

    return NextResponse.json({ imageUrl, textContent, _raw: data });
  } catch (err) {
    console.error("[suggest] unexpected error:", err);
    return NextResponse.json(
      { imageUrl: null, textContent: String(err), _raw: null },
      { status: 500 }
    );
  }
}
