"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { PendingUpdate } from "@/types";

interface UpdateStackProps {
  pendingUpdates: PendingUpdate[];
  mode: "draw" | "review";
  isGenerating: boolean;
  onAccept: (update: PendingUpdate) => void;
  onReject: (update: PendingUpdate) => void;
}

export default function UpdateStack({
  pendingUpdates,
  mode,
  isGenerating,
  onAccept,
  onReject,
}: UpdateStackProps) {
  const top = pendingUpdates[0];
  const queued = pendingUpdates.slice(1);

  return (
    <div className="flex flex-col gap-2 p-3">
      <AnimatePresence mode="popLayout">
        {/* Active top item */}
        {top && (
          <motion.div
            key={top.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="rounded-md border border-gray-900 bg-white overflow-hidden shadow-[2px_2px_0px_rgba(0,0,0,0.12)]"
          >
            {/* Thumbnail */}
            <div className="w-full h-20 bg-gray-50 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={top.diffPng}
                alt="suggestion preview"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Prompt */}
            <div className="px-3 pt-2 pb-1">
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                {top.prompt}
              </p>
            </div>

            {/* Accept / Reject */}
            <div className="flex gap-2 px-3 pb-3 pt-1">
              <motion.button
                onClick={() => onAccept(top)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-sm bg-gray-900 hover:bg-gray-700 text-white font-semibold transition-colors border border-gray-900"
              >
                <span className="text-xl leading-none">✓</span>
                <span className="text-[10px] tracking-widest uppercase">Keep</span>
              </motion.button>
              <motion.button
                onClick={() => onReject(top)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-sm bg-white hover:bg-gray-100 text-gray-900 font-semibold transition-colors border border-gray-900"
              >
                <span className="text-xl leading-none">✕</span>
                <span className="text-[10px] tracking-wide uppercase">Discard</span>
              </motion.button>
            </div>

            {/* Keyboard hint */}
            {mode === "review" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-1.5 pb-2.5"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px] font-mono">Tab</kbd>
                <span className="text-[10px] text-gray-300">keep</span>
                <span className="text-[10px] text-gray-200 mx-0.5">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px] font-mono">Del</kbd>
                <span className="text-[10px] text-gray-300">discard</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Queued items — compact rows */}
        {queued.map((update) => (
          <motion.div
            key={update.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="flex items-center gap-2 px-2.5 py-2 rounded border border-gray-200 bg-white"
          >
            <div className="w-8 h-8 rounded overflow-hidden bg-gray-50 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={update.diffPng} alt="" className="w-full h-full object-cover opacity-60" />
            </div>
            <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed flex-1">
              {update.prompt}
            </p>
          </motion.div>
        ))}

        {/* Loading skeleton */}
        {isGenerating && (
          <motion.div
            key="skeleton"
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="rounded-md border border-gray-300 bg-white overflow-hidden"
          >
            <div className="w-full h-20 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-full" />
              <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-3/5" />
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-3">
              <span className="inline-block w-3 h-3 rounded-full border border-gray-400 border-t-transparent animate-spin" />
              <span className="text-[11px] text-gray-500 font-mono">Generating…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
