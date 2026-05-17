import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, canvasSnapshot } = (await req.json()) as {
      messages: ChatMessage[];
      canvasSnapshot: string;
    };

    const formattedMessages = messages.map((m) =>
      m.role === "user"
        ? {
            role: "user" as const,
            content: [
              {
                type: "image_url",
                image_url: { url: m.canvasSnapshot ?? canvasSnapshot },
              },
              { type: "text", text: m.content },
            ],
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
When the user asks for a visual change, describe what you will do and set shouldGenerate: true.
When the user asks a question or wants to discuss, respond conversationally and set shouldGenerate: false.
Always respond in JSON only: { "reply": string, "shouldGenerate": boolean }`,
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

    let parsed: { reply: string; shouldGenerate: boolean };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = { reply: raw, shouldGenerate: false };
    }

    return NextResponse.json({
      reply: parsed.reply ?? "Got it.",
      shouldGenerate: parsed.shouldGenerate ?? false,
    });
  } catch (err) {
    console.error("/api/chat error:", err);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again.", shouldGenerate: false },
      { status: 500 }
    );
  }
}
