import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, hasOpenRouterApiKey } from "@/lib/openrouter";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, canvasSnapshot } = (await req.json()) as {
      messages: ChatMessage[];
      canvasSnapshot: string;
    };

    if (!hasOpenRouterApiKey()) {
      return NextResponse.json({
        reply: "I can see the whiteboard, but AI suggestions need OPENROUTER_API_KEY in the repo .env.",
        shouldGenerate: false,
        subPrompts: null,
      });
    }

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

SPLITTING RULES — split by distinct page sections, NOT by individual items within the same component:
- Each subPrompt = one section or one component group. Never split a group of same-type items into separate prompts.
- SAME TYPE = one prompt: a row of nav links, a set of buttons, a card grid, a list of features, a group of icons. Even if the items differ in content, they are one visual unit.
- DIFFERENT SECTIONS = separate prompts: navbar vs. hero vs. footer are genuinely different sections.
- Aim for 2–3 subPrompts per request. Never exceed 3 total.

SPATIAL RULES — each subPrompt MUST name a non-overlapping vertical region so the edits don't collide:
- Always append the target zone in parentheses: (top of page), (upper-middle), (center), (lower-middle), (bottom of page).
- Assign zones top-to-bottom in the order elements appear on the page. No two subPrompts may share the same zone.
- Example for "basic website template" → [
    "Add a navigation bar with a logo left and 4 nav links right (top of page)",
    "Add a full-width hero section with heading, subheading, and CTA button (upper-middle)",
    "Add a 3-column features section with icon placeholders and short text (center)"
  ]
- Example for "add a navbar and footer" → [
    "Add a navigation bar with logo and links (top of page)",
    "Add a footer with contact info and nav links (bottom of page)"
  ]
- Example for "add 3 pricing cards" → ONE prompt: "Add a row of 3 pricing cards side by side (center)" — do NOT split into 3 separate prompts.

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
