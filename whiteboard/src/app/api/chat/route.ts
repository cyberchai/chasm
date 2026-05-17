import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, canvasSnapshot } = (await req.json()) as {
      messages: ChatMessage[];
      canvasSnapshot: string;
    };

    // Only attach the canvas image to the most recent user message.
    // Including snapshots in every historical message inflates the request body
    // past Next.js's body size limit when messages accumulate.
    const formattedMessages = messages.map((m, i) =>
      m.role === "user"
        ? {
            role: "user" as const,
            content:
              i === messages.length - 1
                ? [
                    {
                      type: "image_url",
                      image_url: { url: m.canvasSnapshot ?? canvasSnapshot },
                    },
                    { type: "text", text: m.content },
                  ]
                : m.content,
          }
        : { role: "assistant" as const, content: m.content }
    );

    const res = await callOpenRouter({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a website design assistant helping a user refine their website mockup.
The user is drawing wireframes on a canvas. You can see the current canvas state in each message.

When the user asks for a visual change, set shouldGenerate: true and populate subPrompts.

SPLITTING RULES — always decompose into the smallest possible atomic additions:
- Every distinct page section or UI element = its own subPrompt. Never combine sections.
- "basic website template" → ["Add a top navigation bar with a logo on the left and 3–4 nav links on the right", "Add a full-width hero section with a large heading, one-line subheading, and a CTA button centered below", "Add a 3-column features/services section with icon placeholders and short text", "Add a footer with contact info on the left and nav links on the right"]
- "add a navbar and footer" → two subPrompts, one each.
- Even a single-element request like "add a contact form" should be ONE subPrompt.
- Aim for 2–3 subPrompts per request. Never exceed 3 total.

Each subPrompt must be a clear, direct instruction describing exactly ONE element (e.g. "Add a navigation bar at the top with the site logo on the left and menu links on the right").

When the user asks a question or wants to discuss, respond conversationally and set shouldGenerate: false (subPrompts can be omitted).

Always respond in JSON only: { "reply": string, "shouldGenerate": boolean, "subPrompts"?: string[] }`,
        },
        ...formattedMessages,
      ],
      response_format: { type: "json_object" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("OpenRouter chat error:", text);
      return NextResponse.json(
        { reply: "Something went wrong. Please try again.", shouldGenerate: false },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { reply: string; shouldGenerate: boolean; subPrompts?: string[] };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = { reply: raw, shouldGenerate: false };
    }

    return NextResponse.json({
      reply: parsed.reply ?? "Got it.",
      shouldGenerate: parsed.shouldGenerate ?? false,
      subPrompts: parsed.subPrompts ?? null,
    });
  } catch (err) {
    console.error("/api/chat error:", err);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again.", shouldGenerate: false },
      { status: 500 }
    );
  }
}
