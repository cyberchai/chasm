import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";

// GET /api/debug-suggest — calls Gemini with a tiny 1x1 white PNG and returns
// the raw OpenRouter response so we can see exactly what structure it uses.
export async function GET(_req: NextRequest) {
  // Minimal 1x1 white PNG as base64 data URL
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

  try {
    const res = await callOpenRouter({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: tinyPng } },
            { type: "text", text: "Add a small circle to this image." },
          ],
        },
      ],
      modalities: ["image", "text"],
    });

    const status = res.status;
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as null
    }

    return NextResponse.json({ status, raw: parsed ?? text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
