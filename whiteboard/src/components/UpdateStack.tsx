"use client";

import type { PendingUpdate } from "@/types";

interface UpdateStackProps {
  pendingUpdates: PendingUpdate[];
  mode: "draw" | "review";
}

export default function UpdateStack({ pendingUpdates, mode }: UpdateStackProps) {
  if (pendingUpdates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-3">
      {pendingUpdates.map((update, i) => (
        <div
          key={update.id}
          className={`rounded-2xl border bg-white transition-all duration-300 overflow-hidden ${
            i === 0
              ? "border-violet-200 shadow-md shadow-violet-100/50 opacity-100"
              : "border-gray-100 opacity-40"
          }`}
        >
          {/* Diff thumbnail */}
          <div className="w-full h-24 bg-gray-50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={update.diffPng}
              alt="suggestion preview"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="px-3 py-2.5">
            {/* Prompt text */}
            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
              {update.prompt}
            </p>

            {/* Keyboard hint — only on top card in review mode */}
            {i === 0 && mode === "review" && (
              <div className="mt-2 flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono">Tab</kbd>
                <span className="text-[10px] text-gray-400">accept</span>
                <span className="text-[10px] text-gray-300 mx-0.5">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono">Del</kbd>
                <span className="text-[10px] text-gray-400">reject</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
