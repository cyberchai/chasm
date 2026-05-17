"use client";

import type { Status } from "@/types";

export default function StatusIndicator({ status }: { status: Status }) {
  if (status === "idle") return null;

  const styles: Record<Exclude<Status, "idle">, string> = {
    generating: "bg-blue-100 text-blue-700",
    success: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-700",
  };

  const labels: Record<Exclude<Status, "idle">, string> = {
    generating: "Generating…",
    success: "Done",
    error: "Something went wrong",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${styles[status as Exclude<Status, "idle">]}`}
    >
      {status === "generating" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {labels[status as Exclude<Status, "idle">]}
    </span>
  );
}
