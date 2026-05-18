"use client";

import { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Step {
  selector?: string;
  fixedRect?: { xFrac: number; yFrac: number; wFrac: number; hFrac: number };
  title: string;
  body: string;
  callout: "above" | "below" | "left" | "right" | "center";
  pad?: number;
}

const STEPS: Step[] = [
  {
    fixedRect: { xFrac: 0.15, yFrac: 0.15, wFrac: 0.7, hFrac: 0.7 },
    title: "Your Whiteboard",
    body: "Draw directly on your website screenshot — circles, arrows, sketches — to show what you want changed. The AI reads your drawing.",
    callout: "center",
    pad: 0,
  },
  {
    selector: "[data-tutorial='chat']",
    title: "Chat with AI",
    body: "Describe changes in plain English. The AI reads your drawing and generates design suggestions automatically.",
    callout: "left",
    pad: 12,
  },
  {
    selector: "[data-tutorial='submit']",
    title: "Submit",
    body: "Happy with your design? Hit Submit to finalise your website. Keep iterating until you are ready.",
    callout: "left",
    pad: 10,
  },
];

interface Rect { x: number; y: number; w: number; h: number }

function measureStep(step: Step): Rect {
  if (step.fixedRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { xFrac, yFrac, wFrac, hFrac } = step.fixedRect;
    return { x: vw * xFrac, y: vh * yFrac, w: vw * wFrac, h: vh * hFrac };
  }
  if (step.selector) {
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = step.pad ?? 12;
      return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
    }
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };

const CALLOUT_W = 280;

function calloutStyle(rect: Rect, position: Step["callout"]): React.CSSProperties {
  const gap = 20;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  if (position === "center") {
    return { position: "fixed", left: vw / 2, top: vh / 2, transform: "translate(-50%, -50%)" };
  }
  if (position === "above") {
    return {
      position: "fixed",
      left: Math.min(Math.max(rect.x + rect.w / 2, CALLOUT_W / 2 + 8), vw - CALLOUT_W / 2 - 8),
      top: rect.y - gap,
      transform: "translate(-50%, -100%)",
    };
  }
  if (position === "below") {
    return {
      position: "fixed",
      left: Math.min(Math.max(rect.x + rect.w / 2, CALLOUT_W / 2 + 8), vw - CALLOUT_W / 2 - 8),
      top: Math.min(rect.y + rect.h + gap, vh - 320),
      transform: "translateX(-50%)",
    };
  }
  if (position === "left") {
    return {
      position: "fixed",
      left: Math.max(rect.x - gap - CALLOUT_W, 8),
      top: Math.min(Math.max(rect.y + rect.h / 2 - 160, 8), vh - 320),
      transform: "none",
    };
  }
  return {
    position: "fixed",
    left: Math.min(rect.x + rect.w + gap, vw - CALLOUT_W - 8),
    top: Math.min(Math.max(rect.y + rect.h / 2 - 160, 8), vh - 320),
    transform: "none",
  };
}

const arrowFor: Record<Step["callout"], string | null> = {
  above:  "bottom-[-7px] left-1/2 -translate-x-1/2 border-t-white border-l-transparent border-r-transparent border-b-transparent",
  below:  "top-[-7px] left-1/2 -translate-x-1/2 border-b-white border-l-transparent border-r-transparent border-t-transparent",
  left:   "right-[-7px] top-8 border-l-white border-t-transparent border-b-transparent border-r-transparent",
  right:  "left-[-7px] top-8 border-r-white border-t-transparent border-b-transparent border-l-transparent",
  center: null,
};

export default function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const maskId = useId().replace(/:/g, "");
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const step = STEPS[idx];

  useEffect(() => {
    const measure = () => setRect(measureStep(step));
    measure();
    const t = setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [idx, step]);

  const advance = () => idx < STEPS.length - 1 ? setIdx(i => i + 1) : onDone();
  const isLast = idx === STEPS.length - 1;

  const pos = calloutStyle(rect, step.callout);
  const arrow = arrowFor[step.callout];

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ width: "100vw", height: "100vh" }}
      >
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <motion.rect
              fill="black"
              rx={16}
              animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
              transition={spring}
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask={`url(#${maskId})`} />
      </svg>

      <motion.div
        className="absolute pointer-events-none"
        style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.9), 0 0 0 4px rgba(255,255,255,0.4)" }}
        animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        transition={spring}
      />

      <div className="absolute inset-0 pointer-events-auto" />

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          className="absolute z-10 pointer-events-auto"
          style={{ width: CALLOUT_W, ...pos }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        >
          {arrow && <div className={`absolute w-0 h-0 border-[8px] ${arrow}`} />}

          <div className="bg-white border border-gray-900 shadow-[3px_3px_0px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="flex h-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 transition-all duration-500"
                  style={{ backgroundColor: i <= idx ? "#111" : "#e5e7eb" }}
                />
              ))}
            </div>

            <div className="px-5 pt-3 pb-5">
              <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 font-mono mb-2">
                {idx + 1} / {STEPS.length}
              </p>
              <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug uppercase tracking-wide">{step.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-5">{step.body}</p>

              <motion.button
                onClick={advance}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold tracking-widest uppercase transition-colors border border-gray-900"
              >
                {isLast ? "Let's go" : "Got it"}
              </motion.button>

              <button
                onClick={onDone}
                className="w-full mt-2 py-1.5 text-[10px] text-gray-300 hover:text-gray-600 transition-colors tracking-wide"
              >
                Skip
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
