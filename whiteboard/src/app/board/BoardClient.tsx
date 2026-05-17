"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import StatusIndicator from "@/components/StatusIndicator";
import UpdateStack from "@/components/UpdateStack";
import type { CanvasHandle } from "@/components/Canvas";
import { submitFinalPng } from "@/lib/orchestrator";
import type { ChatMessage, Mode, PendingUpdate, Status } from "@/types";

const Canvas = dynamic(() => import("@/components/Canvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
      Loading canvas…
    </div>
  ),
});

export default function BoardClient({ businessId }: { businessId: string }) {
  const orchestratorUrl =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3000";
  const screenshotUrl = `${orchestratorUrl}/api/screenshot?b=${businessId}`;

  const canvasRef = useRef<CanvasHandle>(null);

  const [mode, setMode] = useState<Mode>("draw");
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Total suggestions we plan to generate in this batch — known before any start.
  const [generatingTotal, setGeneratingTotal] = useState<number | null>(null);

  const handleUpdateAdd = useCallback((update: PendingUpdate) => {
    setPendingUpdates((prev) => [...prev, update]);
  }, []);

  const handleUpdateAccept = useCallback((update: PendingUpdate) => {
    setPendingUpdates((prev) => {
      const next = prev.filter((u) => u.id !== update.id);
      if (next.length === 0) setMode("draw");
      return next;
    });
  }, []);

  const handleUpdateReject = useCallback((update: PendingUpdate) => {
    setPendingUpdates((prev) => {
      const next = prev.filter((u) => u.id !== update.id);
      if (next.length === 0) setMode("draw");
      return next;
    });
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const snapshot = (await canvasRef.current?.captureCanvas()) ?? "";

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        canvasSnapshot: snapshot,
      };
      setMessages((prev) => [...prev, userMsg]);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          canvasSnapshot: snapshot,
        }),
      });
      const { reply, shouldGenerate, subPrompts } = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);

      if (shouldGenerate) {
        const prompts: string[] = (
          Array.isArray(subPrompts) && subPrompts.length > 0 ? subPrompts : [text]
        ).slice(0, 3);
        // Set the total before any generation so the UI shows "0 / N" immediately.
        setGeneratingTotal(prompts.length);
        for (const p of prompts) {
          await canvasRef.current?.generateSuggestion(p);
        }
        setGeneratingTotal(null);
        setMode("review");
      }
    },
    [messages]
  );

  const handleSubmit = useCallback(async () => {
    if (mode === "review" || submitting) return;
    setSubmitting(true);
    try {
      const base64 = (await canvasRef.current?.captureForSubmit()) ?? "";
      await submitFinalPng(businessId, base64);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Submit failed — is the orchestrator running?");
    } finally {
      setSubmitting(false);
    }
  }, [mode, submitting, businessId]);

  const canSubmit =
    mode === "draw" && status !== "generating" && !submitted && !submitting;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Canvas fills the entire screen */}
      <Canvas
        ref={canvasRef}
        mode={mode}
        pendingUpdates={pendingUpdates}
        businessId={businessId}
        screenshotUrl={screenshotUrl}
        onModeChange={setMode}
        onUpdateAdd={handleUpdateAdd}
        onUpdateAccept={handleUpdateAccept}
        onUpdateReject={handleUpdateReject}
        onStatusChange={setStatus}
      />

      {/* Floating top bar */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/85 backdrop-blur-xl shadow-lg shadow-black/10 border border-white/60 whitespace-nowrap">
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back
        </a>

        {submitted ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            ✓ Submitted
          </span>
        ) : status !== "idle" ? (
          <StatusIndicator status={status} />
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-1.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </header>

      {/* Floating left panel — suggestions (visible for the full generation batch + review) */}
      {(pendingUpdates.length > 0 || generatingTotal !== null) && (
        <aside className="fixed left-4 top-20 bottom-4 z-20 w-56 flex flex-col rounded-3xl bg-white/85 backdrop-blur-xl shadow-2xl shadow-black/10 border border-white/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100/80 shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Suggestions</h2>
            {generatingTotal !== null ? (
              <span className="flex items-center gap-1.5 ml-auto text-[11px] text-violet-500 font-semibold">
                <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                {pendingUpdates.length} / {generatingTotal}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">
                {pendingUpdates.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <UpdateStack
              pendingUpdates={pendingUpdates}
              mode={mode}
              isGenerating={generatingTotal !== null}
              onAccept={(u) => canvasRef.current?.acceptUpdate(u)}
              onReject={(u) => canvasRef.current?.rejectUpdate(u)}
            />
          </div>
        </aside>
      )}

      {/* Floating right panel — chat */}
      <aside className="fixed right-4 top-20 bottom-4 z-20 w-72 flex flex-col rounded-3xl bg-white/85 backdrop-blur-xl shadow-2xl shadow-black/10 border border-white/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100/80 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">Chat</h2>
        </div>
        <ChatPanel messages={messages} mode={mode} onSend={handleSend} />
      </aside>
    </div>
  );
}
