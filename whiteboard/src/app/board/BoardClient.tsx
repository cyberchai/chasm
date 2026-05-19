"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatPanel from "@/components/ChatPanel";
import StatusIndicator from "@/components/StatusIndicator";
import TutorialOverlay from "@/components/TutorialOverlay";
import UpdateStack from "@/components/UpdateStack";
import type { CanvasHandle } from "@/components/Canvas";
import { submitFinalPng } from "@/lib/orchestrator";
import type { ChatMessage, Mode, PendingUpdate, Status } from "@/types";

const Canvas = dynamic(() => import("@/components/Canvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
      Loading…
    </div>
  ),
});

const spring = { type: "spring" as const, stiffness: 300, damping: 28 };
const panel = "bg-white border border-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,0.15)]";

export default function BoardClient({ businessId }: { businessId: string }) {
  // The whiteboard is the "draw from scratch" surface — start on a blank
  // canvas. An empty screenshotUrl makes Canvas seed a blank white background.
  const screenshotUrl = "";

  const canvasRef = useRef<CanvasHandle>(null);

  const [mode, setMode] = useState<Mode>("draw");
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [generatingTotal, setGeneratingTotal] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const handleUpdateAdd = useCallback((update: PendingUpdate) => {
    setPendingUpdates((prev) => [...prev, update]);
    setSuggestionsOpen(true);
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
        body: JSON.stringify({ messages: [...messages, userMsg], canvasSnapshot: snapshot }),
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
      const result = await submitFinalPng(businessId, base64);
      setSiteUrl(result.url ?? null);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
      alert(
        "Build failed — check the orchestrator. " +
          (err instanceof Error ? err.message : "")
      );
    } finally {
      setSubmitting(false);
    }
  }, [mode, submitting, businessId]);

  const canSubmit = mode === "draw" && status !== "generating" && !submitted && !submitting;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <AnimatePresence>
        {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* Canvas */}
      <div data-tutorial="canvas" className="absolute inset-0">
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
      </div>

      {/* Back */}
      <motion.a
        href="/"
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`fixed top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-md ${panel} text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap tracking-wide`}
      >
        ← Back
      </motion.a>

      {/* Status */}
      <AnimatePresence mode="wait">
        {status !== "idle" && !submitted && (
          <motion.div
            key={status}
            initial={{ y: -16, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.9 }}
            transition={spring}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <StatusIndicator status={status} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.div
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="fixed top-4 right-4 z-20"
        data-tutorial="submit"
      >
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.a
              key="submitted"
              href={siteUrl ?? "http://localhost:5173"}
              target="_blank"
              rel="noreferrer"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-xs font-semibold tracking-wide border border-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,0.2)] hover:bg-gray-700 transition-colors whitespace-nowrap`}
            >
              View your site →
            </motion.a>
          ) : (
            <motion.button
              key="submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
              whileHover={canSubmit ? { scale: 1.03 } : {}}
              whileTap={canSubmit ? { scale: 0.97 } : {}}
              className={`px-4 py-2 rounded-md bg-gray-900 text-white text-xs font-semibold tracking-wide border border-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,0.2)] hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap`}
            >
              {submitting ? "Building your site…" : "Submit"}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Suggestions collapsed button */}
      <AnimatePresence>
        {(pendingUpdates.length > 0 || generatingTotal !== null) && !suggestionsOpen && (
          <motion.button
            key="suggestions-toggle"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={spring}
            onClick={() => setSuggestionsOpen(true)}
            className={`fixed left-4 top-20 z-20 px-3 py-2 rounded-md ${panel} text-xs font-bold text-gray-900 tracking-widest uppercase hover:bg-gray-50 transition-colors flex items-center gap-2`}
          >
            <span>Suggestions</span>
            <span className="px-1.5 py-0.5 border border-gray-300 text-gray-500 rounded text-[10px] font-mono">
              {pendingUpdates.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Suggestions panel — slides in from left */}
      <AnimatePresence>
        {(pendingUpdates.length > 0 || generatingTotal !== null) && suggestionsOpen && (
          <motion.aside
            key="suggestions-panel"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className={`fixed left-4 top-20 bottom-4 z-20 w-52 flex flex-col rounded-md ${panel} overflow-hidden`}
          >
            <button
              onClick={() => setSuggestionsOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 shrink-0 w-full text-left hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-xs font-bold text-gray-900 tracking-widest uppercase">Suggestions</h2>
              <AnimatePresence mode="wait">
                {generatingTotal !== null ? (
                  <motion.span
                    key="gen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1 ml-auto text-[10px] text-gray-500 font-mono"
                  >
                    <span className="inline-block w-2 h-2 rounded-full border border-gray-400 border-t-transparent animate-spin" />
                    {pendingUpdates.length}/{generatingTotal}
                  </motion.span>
                ) : (
                  <motion.span
                    key="count"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="ml-auto px-1.5 py-0.5 border border-gray-300 text-gray-500 rounded text-[10px] font-mono"
                  >
                    {pendingUpdates.length}
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="text-gray-400 text-xs font-mono ml-1">−</span>
            </button>
            <div className="flex-1 overflow-y-auto min-h-0">
              <UpdateStack
                pendingUpdates={pendingUpdates}
                mode={mode}
                isGenerating={generatingTotal !== null}
                onAccept={(u) => canvasRef.current?.acceptUpdate(u)}
                onReject={(u) => canvasRef.current?.rejectUpdate(u)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Chat toggle button — visible only when collapsed */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            key="chat-toggle"
            data-tutorial="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={spring}
            onClick={() => setChatOpen(true)}
            className={`fixed right-4 top-20 z-20 px-3 py-2 rounded-md ${panel} text-xs font-bold text-gray-900 tracking-widest uppercase hover:bg-gray-50 transition-colors`}
          >
            Chat +
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel — slides off-screen when closed */}
      <AnimatePresence>
        {chatOpen && (
          <motion.aside
            key="chat-panel"
            data-tutorial="chat"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed right-4 top-20 bottom-4 z-20 flex flex-col rounded-md ${panel} overflow-hidden`}
            style={{ width: 272 }}
          >
            <button
              onClick={() => setChatOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 shrink-0 w-full text-left hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-xs font-bold text-gray-900 tracking-widest uppercase">Chat</h2>
              <span className="text-gray-400 text-xs font-mono">−</span>
            </button>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ChatPanel messages={messages} mode={mode} onSend={handleSend} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
