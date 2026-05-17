import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { EDIT_AGENT_PROMPT } from "./paths.js";

/** Cache the system prompt — keep it byte-stable so the SDK prompt cache stays warm. */
let cachedSystemPrompt: string | null = null;
async function systemPromptText(): Promise<string> {
  if (cachedSystemPrompt === null) {
    cachedSystemPrompt = await readFile(EDIT_AGENT_PROMPT, "utf8");
  }
  return cachedSystemPrompt;
}

function mediaType(path: string): "image/jpeg" | "image/png" {
  const p = path.toLowerCase();
  return p.endsWith(".jpg") || p.endsWith(".jpeg") ? "image/jpeg" : "image/png";
}

/** Whiteboard ingestion: read a PNG/JPEG off disk into a base64 image block. */
async function imageBlock(path: string) {
  const data = (await readFile(path)).toString("base64");
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: mediaType(path), data },
  };
}

export interface RunEditAgentOptions {
  /** The site directory — the agent's working dir. */
  cwd: string;
  /** Voice transcript or text instruction. */
  instruction: string;
  /** Path to an annotated whiteboard PNG, when the edit came from the canvas. */
  whiteboardPng?: string;
  /** Path to a current site screenshot, for vision "before" context. */
  currentScreenshot?: string;
}

/**
 * Run one edit pass with the Claude Agent SDK against the site at `cwd`.
 * The agent reads and edits files in place; Vite HMR shows the result.
 * Returns the agent's final one-line summary (spoken back to the owner).
 */
export async function runEditAgent(opts: RunEditAgentOptions): Promise<string> {
  const { cwd, instruction, whiteboardPng, currentScreenshot } = opts;
  const system = await systemPromptText();

  // Images are passed in a fixed order; the agent is told what each one is.
  const images: { label: string; path: string }[] = [];
  if (currentScreenshot) {
    images.push({ label: "the current site", path: currentScreenshot });
  }
  if (whiteboardPng) {
    images.push({
      label: "the owner's whiteboard — annotations drawn on top of the current site",
      path: whiteboardPng,
    });
  }

  const promptText =
    images.length > 0
      ? `${instruction}\n\nAttached images, in order: ${images
          .map((i) => i.label)
          .join("; ")}. Apply the change to the site in your working directory.`
      : `${instruction}\n\nApply the change to the site in your working directory.`;

  // No images → plain string prompt. Images → async-iterable user message.
  const prompt =
    images.length === 0
      ? promptText
      : (async function* () {
          const content: unknown[] = [];
          for (const img of images) content.push(await imageBlock(img.path));
          content.push({ type: "text", text: promptText });
          yield {
            type: "user" as const,
            message: { role: "user" as const, content },
            parent_tool_use_id: null,
          };
        })();

  // `as never` at the SDK boundary — exact prompt/option types are SDK-internal.
  const q = query({
    prompt: prompt as never,
    options: {
      cwd,
      model: "claude-opus-4-7",
      effort: "xhigh",
      thinking: { type: "adaptive" },
      tools: ["Read", "Edit", "Write", "Glob", "Grep"],
      permissionMode: "acceptEdits",
      maxTurns: 25,
      systemPrompt: { type: "preset", preset: "claude_code", append: system },
    } as never,
  });

  let lastText = "";
  for await (const msg of q as AsyncIterable<Record<string, unknown>>) {
    if (msg.type === "assistant") {
      const message = msg.message as { content?: Array<Record<string, unknown>> };
      for (const block of message?.content ?? []) {
        if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
          lastText = block.text.trim();
        }
      }
    }
  }
  return lastText || "Edit applied.";
}
