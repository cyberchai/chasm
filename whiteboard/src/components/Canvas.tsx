"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
  type TLImageShape,
  type TLShapeId,
} from "tldraw";
import "tldraw/tldraw.css";
import { useKeyboardReview } from "@/hooks/useKeyboardReview";
import { computeDiff } from "@/hooks/usePixelDiff";
import type { Mode, PendingUpdate, Status } from "@/types";
import { applyAlpha, blobToBase64, correctYellowedWhites } from "@/utils/imageProcessing";

// Force white background in both light and dark mode
DefaultColorThemePalette.lightMode.background = "#FFFFFF";
DefaultColorThemePalette.darkMode.background = "#FFFFFF";

export interface CanvasHandle {
  generateSuggestion: (prompt: string) => Promise<void>;
  captureCanvas: () => Promise<string>;
  captureForSubmit: () => Promise<string>;
  acceptUpdate: (update: PendingUpdate) => void;
  rejectUpdate: (update: PendingUpdate) => void;
}

type BgBounds = { x: number; y: number; w: number; h: number };

interface CanvasControllerProps {
  mode: Mode;
  pendingUpdates: PendingUpdate[];
  bgBoundsRef: React.MutableRefObject<BgBounds>;
  onAccept: (update: PendingUpdate) => void;
  onReject: (update: PendingUpdate) => void;
}

function CanvasController({
  mode,
  pendingUpdates,
  bgBoundsRef,
  onAccept,
  onReject,
}: CanvasControllerProps) {
  const editor = useEditor();

  // Switch tool instead of isReadonly — isReadonly silently blocks programmatic
  // updateShape/deleteShape calls, so accept/reject would both appear as "accept".
  // Hand tool prevents drawing while leaving the programmatic API fully open.
  useEffect(() => {
    if (mode === "review") {
      editor.setCurrentTool("hand");
    } else {
      editor.setCurrentTool("draw");
    }
  }, [editor, mode]);

  // tldraw silently ignores opacity updates on locked shapes (same as deleteShape).
  // Must unlock → set opacity → re-lock for each shape.
  useEffect(() => {
    pendingUpdates.forEach((update, i) => {
      editor.updateShape({ id: update.shapeId, type: "image", isLocked: false, opacity: i === 0 ? 1 : 0 });
      editor.updateShape({ id: update.shapeId, type: "image", isLocked: true });
    });
  }, [editor, pendingUpdates]);

  useKeyboardReview({ mode, pendingUpdates, onAccept, onReject });

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
  const bgBoundsRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0, y: 0, w: 1280, h: 800,
  });

  useEffect(() => {
    pendingUpdatesRef.current = pendingUpdates;
  }, [pendingUpdates]);

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

  // Accept: swap the ghost asset (baked 0.55 alpha) for the full-opacity diff,
  // then remove from queue. No tldraw opacity change needed — asset src does it.
  const handleAccept = useCallback(
    (update: PendingUpdate) => {
      const editor = editorRef.current;
      if (!editor) return;
      const shape = editor.getShape<TLImageShape>(update.shapeId);
      if (shape?.props.assetId) {
        const asset = editor.getAsset(shape.props.assetId);
        if (asset) {
          editor.store.put([{ ...asset, props: { ...asset.props, src: update.diffPng } }]);
        }
      }
      onUpdateAccept(update);
    },
    [onUpdateAccept]
  );

  // Reject: must unlock before delete — tldraw silently skips deleteShape on locked shapes.
  const handleReject = useCallback(
    (update: PendingUpdate) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.updateShape({ id: update.shapeId, type: "image", isLocked: false });
      editor.deleteShape(update.shapeId);
      onUpdateReject(update);
    },
    [onUpdateReject]
  );

  const generateSuggestion = useCallback(
    async (prompt: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      onStatusChange("generating");

      try {
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

        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, prompt }),
        });
        const json = await res.json();
        const { imageUrl, _raw } = json;

        console.log("[Canvas] /api/suggest response:", {
          status: res.status,
          imageUrl: imageUrl ? imageUrl.slice(0, 80) + "…" : null,
          messageKeys: _raw?.choices?.[0]?.message ? Object.keys(_raw.choices[0].message) : null,
        });

        if (!imageUrl) {
          const msg = _raw?.choices?.[0]?.message ?? {};
          console.error("[Canvas] No imageUrl. message keys:", Object.keys(msg));
          onStatusChange("error");
          return;
        }

        const { diffBase64, boundingBox } = await computeDiff(
          lastScreenshotRef.current,
          imageUrl
        );
        const cleanDiff = await correctYellowedWhites(diffBase64);
        // Bake 55% alpha into the image pixels so tldraw shape opacity isn't needed
        // for the ghost effect. cleanDiff (full alpha) is kept for the accept swap.
        const ghostDiff = await applyAlpha(cleanDiff, 0.55);

        const assetId = AssetRecordType.createId();
        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "diff.png",
              src: ghostDiff,
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
          opacity: 0,
          isLocked: true,
          props: { w: bgW, h: bgH, assetId },
        });

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
        onStatusChange("success");
        setTimeout(() => onStatusChange("idle"), 2000);
      } catch (err) {
        console.error("generateSuggestion failed:", err);
        onStatusChange("error");
      }
    },
    [onUpdateAdd, onStatusChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      generateSuggestion,
      captureCanvas,
      captureForSubmit,
      acceptUpdate: handleAccept,
      rejectUpdate: handleReject,
    }),
    [generateSuggestion, captureCanvas, captureForSubmit, handleAccept, handleReject]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.setStyleForNextShapes(DefaultColorStyle, "grey");
      editor.setStyleForNextShapes(DefaultSizeStyle, "s");
      editor.setStyleForNextShapes(DefaultDashStyle, "solid");
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
        requestAnimationFrame(() => {
          const { x, y, w, h } = bgBoundsRef.current;
          zoomToFit(editor, x, y, w, h);
          editor.setCameraOptions({ isLocked: true });
        });
      };
      load();
    },
    [screenshotUrl]
  );

  const tlComponents = useMemo(() => ({
    MenuPanel: null,
    NavigationPanel: null,
    HelperButtons: null,
    StylePanel: null,
    Toolbar: mode === "review" ? null : undefined,
  }), [mode]);

  return (
    <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <Tldraw
        components={tlComponents}
        onMount={handleMount}
      >
        <CanvasController
          mode={mode}
          pendingUpdates={pendingUpdates}
          bgBoundsRef={bgBoundsRef}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </Tldraw>
    </div>
  );
});

export default Canvas;

function zoomToFit(editor: Editor, bgX: number, bgY: number, bgW: number, bgH: number) {
  editor.zoomToBounds(
    new Box(bgX, bgY, bgW, bgH),
    { animation: { duration: 0 }, inset: 0 }
  );
}

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
  return { x: 0, y: 0, w: 1280, h: 800 };
}
