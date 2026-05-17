import type { TLShapeId } from "tldraw";

export type Mode = "draw" | "review";
export type Status = "idle" | "generating" | "success" | "error";

export type PendingUpdate = {
  id: string;
  diffPng: string;
  boundingBox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  prompt: string;
  shapeId: TLShapeId;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  canvasSnapshot?: string;
};
