import { useEffect } from "react";
import type { PendingUpdate } from "@/types";

export function useKeyboardReview({
  mode,
  pendingUpdates,
  onAccept,
  onReject,
}: {
  mode: "draw" | "review";
  pendingUpdates: PendingUpdate[];
  onAccept: (update: PendingUpdate) => void;
  onReject: (update: PendingUpdate) => void;
}) {
  useEffect(() => {
    if (mode !== "review" || pendingUpdates.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        onAccept(pendingUpdates[0]);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onReject(pendingUpdates[0]);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, pendingUpdates, onAccept, onReject]);
}
