"use client";

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

  if (pendingUpdates.length === 0 && !isGenerating) return null;

  const top = pendingUpdates[0];

  return (
    <div className="flex flex-col gap-2 p-3">
      {top && (
        <div className="rounded-2xl border border-violet-200 shadow-md shadow-violet-100/50 bg-white overflow-hidden">
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
            <button
              onClick={() => onAccept(top)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold transition-colors shadow-md shadow-emerald-200"
            >
              <span className="text-2xl leading-none">✓</span>
              <span className="text-[11px] tracking-wide uppercase">Keep</span>
            </button>
            <button
              onClick={() => onReject(top)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold transition-colors shadow-md shadow-red-200"
            >
              <span className="text-2xl leading-none">✕</span>
              <span className="text-[11px] tracking-wide uppercase">Discard</span>
            </button>
          </div>

          {/* Keyboard hint */}
          {mode === "review" && (
            <div className="flex items-center justify-center gap-1.5 pb-2.5">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px] font-mono">Tab</kbd>
              <span className="text-[10px] text-gray-300">accept</span>
              <span className="text-[10px] text-gray-200 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px] font-mono">Del</kbd>
              <span className="text-[10px] text-gray-300">reject</span>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton — shown while a generation is in flight */}
      {isGenerating && (
        <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
          <div className="w-full h-20 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
          <div className="px-3 py-2.5 space-y-1.5">
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-full" />
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-3/5" />
          </div>
          <div className="flex items-center gap-1.5 px-3 pb-3">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            <span className="text-[11px] text-violet-400 font-medium">Generating…</span>
          </div>
        </div>
      )}
    </div>
  );
}
