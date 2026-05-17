"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  AssetRecordType,
  Box,
  DefaultColorStyle,
  DefaultColorThemePalette,
  DefaultDashStyle,
  DefaultSizeStyle,
  Tldraw,
  createShapeId,
  useEditor,
  type Editor,
  type TLShapeId,
} from "tldraw";
import "tldraw/tldraw.css";
import { useKeyboardReview } from "@/hooks/useKeyboardReview";
import { computeDiff } from "@/hooks/usePixelDiff";
import type { Mode, PendingUpdate, Status } from "@/types";
import { blobToBase64, correctYellowedWhites } from "@/utils/imageProcessing";

// Force white background in both light and dark mode
DefaultColorThemePalette.lightMode.background = "#FFFFFF";
DefaultColorThemePalette.darkMode.background = "#FFFFFF";

export interface CanvasHandle {
  generateSuggestion: (prompt: string) => Promise<void>;
  captureCanvas: () => Promise<string>;
  captureForSubmit: () => Promise<string>;
}

interface CanvasControllerProps {
  mode: Mode;
  pendingUpdates: PendingUpdate[];
  onUpdateAccept: (update: PendingUpdate) => void;
  onUpdateReject: (update: PendingUpdate) => void;
}

function CanvasController({
  mode,
  pendingUpdates,
  onUpdateAccept,
  onUpdateReject,
}: CanvasControllerProps) {
  const editor = useEditor();
  const isUpdatingRef = useRef(false);

  // Sync readonly state with mode
  useEffect(() => {
    editor.updateInstanceState({ isReadonly: mode === "review" });
  }, [editor, mode]);

  // Zoom to diff and sync opacities when stack changes
  useEffect(() => {
    if (pendingUpdates.length > 0) {
      const { boundingBox: bb } = pendingUpdates[0];
      editor.zoomToBounds(
        new Box(bb.x, bb.y, bb.w, bb.h),
        { animation: { duration: 400 }, inset: 32 }
      );
      // Only top update is visible; rest are hidden until their turn
      pendingUpdates.forEach((update, i) => {
        editor.updateShape({
          id: update.shapeId,
          type: "image",
          isLocked: false,
          opacity: i === 0 ? 1 : 0,
        });
        editor.updateShape({
          id: update.shapeId,
          type: "image",
          isLocked: true,
        });
      });
    }
  }, [editor, pendingUpdates]);

  const handleAccept = useCallback(
    (update: PendingUpdate) => {
      isUpdatingRef.current = true;
      editor.updateShape({
        id: update.shapeId,
        type: "image",
        isLocked: false,
        opacity: 1,
      });
      editor.updateShape({
        id: update.shapeId,
        type: "image",
        isLocked: true,
      });
      onUpdateAccept(update);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    },
    [editor, onUpdateAccept]
  );

  const handleReject = useCallback(
    (update: PendingUpdate) => {
      isUpdatingRef.current = true;
      editor.updateShape({
        id: update.shapeId,
        type: "image",
        isLocked: false,
      });
      editor.deleteShape(update.shapeId);
      onUpdateReject(update);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    },
    [editor, onUpdateReject]
  );

  useKeyboardReview({
    mode,
    pendingUpdates,
    onAccept: handleAccept,
    onReject: handleReject,
  });

  return null;
}

interface CanvasProps {
  mode: Mode;
  pendingUpdates: PendingUpdate[];
  businessId: string;
  screenshotUrl: string;
  onModeChange: (mode: Mode) => void;
  onUpdateAdd: (update: PendingUpdate) => void;
  onUpdateAccept: (update: PendingUpdate) => void;
  onUpdateReject: (update: PendingUpdate) => void;
  onStatusChange: (status: Status) => void;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    mode,
    pendingUpdates,
    screenshotUrl,
    onModeChange,
    onUpdateAdd,
    onUpdateAccept,
    onUpdateReject,
    onStatusChange,
  },
  ref
) {
  const editorRef = useRef<Editor | null>(null);
  const lastScreenshotRef = useRef<string>("");
  const pendingUpdatesRef = useRef<PendingUpdate[]>(pendingUpdates);
  const modeRef = useRef<Mode>(mode);
  // Background bounds — always (0,0,w,h). Used as the canonical capture region.
  const bgBoundsRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0, y: 0, w: 1280, h: 800,
  });

  useEffect(() => {
    pendingUpdatesRef.current = pendingUpdates;
  }, [pendingUpdates]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const captureCanvas = useCallback(async (): Promise<string> => {
    const editor = editorRef.current;
    if (!editor) return "";
    const shapeIds = [...editor.getCurrentPageShapeIds()].filter(
      (id) => !pendingUpdatesRef.current.map((u) => u.shapeId).includes(id)
    );
    if (shapeIds.length === 0) return "";
    try {
      const { blob } = await editor.toImage(shapeIds, {
        format: "png",
        bounds: editor.getViewportPageBounds(),
        background: true,
        scale: 1,
        padding: 0,
      });
      return blobToBase64(blob);
    } catch (err) {
      console.warn("[Canvas] captureCanvas failed:", err);
      return "";
    }
  }, []);

  const captureForSubmit = useCallback(async (): Promise<string> => {
    const editor = editorRef.current;
    if (!editor) return "";
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) return "";
    try {
      const { blob } = await editor.toImage(shapeIds, {
        format: "png",
        background: true,
        scale: 1,
      });
      return blobToBase64(blob);
    } catch (err) {
      console.warn("[Canvas] captureForSubmit failed:", err);
      return "";
    }
  }, []);

  const generateSuggestion = useCallback(
    async (prompt: string) => {
      if (modeRef.current === "review") return;
      const editor = editorRef.current;
      if (!editor) return;

      onStatusChange("generating");

      try {
        // Step 1 — capture at fixed background bounds (consistent scale every time)
        const shapeIds = [...editor.getCurrentPageShapeIds()].filter(
          (id) => !pendingUpdatesRef.current.map((u) => u.shapeId).includes(id)
        );
        if (shapeIds.length === 0) {
          console.warn("[Canvas] generateSuggestion: canvas is empty");
          onStatusChange("error");
          return;
        }
        const { x: bgX, y: bgY, w: bgW, h: bgH } = bgBoundsRef.current;
        let base64: string;
        try {
          const { blob } = await editor.toImage(shapeIds, {
            format: "png",
            bounds: new Box(bgX, bgY, bgW, bgH),
            background: true,
            scale: 1,
            padding: 0,
          });
          base64 = await blobToBase64(blob);
        } catch (captureErr) {
          console.error("[Canvas] toImage failed:", captureErr);
          onStatusChange("error");
          return;
        }
        lastScreenshotRef.current = base64;

        // Step 2 — call Gemini via API route
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, prompt }),
        });
        const json = await res.json();
        const { imageUrl, textContent, _raw } = json;

        console.log("[Canvas] /api/suggest response:", {
          status: res.status,
          imageUrl: imageUrl ? imageUrl.slice(0, 80) + "…" : null,
          textContent: textContent?.slice?.(0, 200),
          messageKeys: _raw?.choices?.[0]?.message ? Object.keys(_raw.choices[0].message) : null,
        });

        if (!imageUrl) {
          const msg = _raw?.choices?.[0]?.message ?? {};
          console.error("[Canvas] No imageUrl. message keys:", Object.keys(msg));
          console.error("[Canvas] images field:", msg.images);
          console.error("[Canvas] content field:", Array.isArray(msg.content) ? msg.content.map((b: {type:string}) => b.type) : msg.content);
          onStatusChange("error");
          return;
        }

        // Step 3 — pixel diff (Gemini image is forced to W×H in computeDiff)
        const { diffBase64, boundingBox } = await computeDiff(
          lastScreenshotRef.current,
          imageUrl
        );

        // Step 4 — yellow-white correction
        const cleanDiff = await correctYellowedWhites(diffBase64);

        // Step 5 — place diff at exact same position/size as background
        const assetId = AssetRecordType.createId();

        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "diff.png",
              src: cleanDiff,
              w: bgW,
              h: bgH,
              mimeType: "image/png",
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        const shapeId: TLShapeId = createShapeId();
        editor.createShape({
          id: shapeId,
          type: "image",
          x: bgX,
          y: bgY,
          opacity: 1,
          isLocked: true,
          props: {
            w: bgW,
            h: bgH,
            assetId,
          },
        });

        // boundingBox is in image-pixel space relative to (bgX, bgY) at scale 1
        const newUpdate: PendingUpdate = {
          id: crypto.randomUUID(),
          diffPng: cleanDiff,
          boundingBox: {
            x: bgX + boundingBox.x,
            y: bgY + boundingBox.y,
            w: boundingBox.w,
            h: boundingBox.h,
          },
          prompt,
          shapeId,
        };

        onUpdateAdd(newUpdate);
        onModeChange("review");
        onStatusChange("success");

        // Clear success badge after 2s
        setTimeout(() => onStatusChange("idle"), 2000);
      } catch (err) {
        console.error("generateSuggestion failed:", err);
        onStatusChange("error");
      }
    },
    [onModeChange, onUpdateAdd, onStatusChange]
  );

  useImperativeHandle(
    ref,
    () => ({ generateSuggestion, captureCanvas, captureForSubmit }),
    [generateSuggestion, captureCanvas, captureForSubmit]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Pencil-like defaults: thin grey hand-drawn strokes
      editor.setStyleForNextShapes(DefaultColorStyle, "grey");
      editor.setStyleForNextShapes(DefaultSizeStyle, "s");
      editor.setStyleForNextShapes(DefaultDashStyle, "draw");
      editor.setCurrentTool("draw");

      const load = async () => {
        if (screenshotUrl) {
          const bounds = await loadScreenshotAsBackground(editor, screenshotUrl).catch(() => {
            return seedBlankCanvas(editor);
          });
          bgBoundsRef.current = bounds;
        } else {
          bgBoundsRef.current = seedBlankCanvas(editor);
        }
        // Re-zoom after a layout frame so tldraw has measured the container correctly
        requestAnimationFrame(() => editor.zoomToFit({ animation: { duration: 0 } }));
      };
      load();
    },
    [screenshotUrl]
  );

  return (
    <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <Tldraw
        components={{
          MenuPanel: null,
          NavigationPanel: null,
          HelperButtons: null,
          StylePanel: null,
        }}
        onMount={handleMount}
      >
        <CanvasController
          mode={mode}
          pendingUpdates={pendingUpdates}
          onUpdateAccept={onUpdateAccept}
          onUpdateReject={onUpdateReject}
        />
      </Tldraw>
    </div>
  );
});

export default Canvas;

async function loadScreenshotAsBackground(
  editor: Editor,
  url: string
): Promise<{ x: number; y: number; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const assetId = AssetRecordType.createId();
  editor.createAssets([
    {
      id: assetId,
      type: "image",
      typeName: "asset",
      props: {
        name: "background.png",
        src: url,
        w: img.width,
        h: img.height,
        mimeType: "image/png",
        isAnimated: false,
      },
      meta: {},
    },
  ]);

  const shapeId = createShapeId();
  editor.createShape({
    id: shapeId,
    type: "image",
    x: 0,
    y: 0,
    isLocked: true,
    props: { w: img.width, h: img.height, assetId },
  });

  editor.zoomToFit({ animation: { duration: 0 } });
  return { x: 0, y: 0, w: img.width, h: img.height };
}

function seedBlankCanvas(
  editor: Editor
): { x: number; y: number; w: number; h: number } {
  const shapeId = createShapeId();
  editor.createShape({
    id: shapeId,
    type: "geo",
    x: 0,
    y: 0,
    isLocked: true,
    props: { w: 1280, h: 800, geo: "rectangle", fill: "solid", color: "white" },
  });
  editor.zoomToFit({ animation: { duration: 0 } });
  return { x: 0, y: 0, w: 1280, h: 800 };
}
