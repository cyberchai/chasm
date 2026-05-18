"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Mode } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  mode: Mode;
  onSend: (text: string) => Promise<void>;
}

export default function ChatPanel({ messages, mode, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const disabled = mode === "review" || sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    setSending(true);
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Draw on the canvas, then describe what you want to change
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gray-900 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Locked hint */}
      {mode === "review" && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-[11px] text-amber-600 text-center leading-relaxed">
            Review the suggestion first —<br />Tab to accept · Delete to reject
          </p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 border-t border-gray-100/80 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          placeholder={
            mode === "review" ? "Locked during review…" : "Describe a change…"
          }
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {sending ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
