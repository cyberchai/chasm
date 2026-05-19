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
import { applyAlpha, blobToBase64, correctYellowedWhites, cropToRegion } from "@/utils/imageProcessing";

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

  useEffect(() => {
    if (mode === "review") {
      editor.setCurrentTool("select");
    } else {
      editor.setCurrentTool("draw");
    }
  }, [editor, mode]);

  // Top item: visible + unlocked for dragging. Others: hidden + locked.
  useEffect(() => {
    pendingUpdates.forEach((update, i) => {
      if (i === 0) {
        editor.updateShape({ id: update.shapeId, type: "image", opacity: 1, isLocked: false });
      } else {
        editor.updateShape({ id: update.shapeId, type: "image", opacity: 0, isLocked: true });
      }
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

  // Accept: swap ghost asset for full-opacity diff, lock shape at wherever user dragged it.
  const handleAccept = useCallback(
    (update: PendingUpdate) => {
      const editor = editorRef.current;
      if (!editor) return;
      const shape = editor.getShape<TLImageShape>(update.shapeId);
      if (shape?.props.assetId) {
        const asset = editor.getAsset(shape.props.assetId);
        if (asset?.type === "image") {
          // Keep the existing props (w/h/mimeType/…) — overriding only `src`,
          // otherwise tldraw validation rejects the asset for a missing w/h.
          editor.updateAssets([
            { id: asset.id, type: "image", props: { ...asset.props, src: update.diffPng } },
          ]);
        }
      }
      editor.updateShape({ id: update.shapeId, type: "image", isLocked: true });
      onUpdateAccept(update);
    },
    [onUpdateAccept]
  );

  // Reject: top item is already unlocked, so deleteShape works directly.
  const handleReject = useCallback(
    (update: PendingUpdate) => {
      const editor = editorRef.current;
      if (!editor) return;
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

        // editor.toImage may output at devicePixelRatio× canvas dimensions.
        // Measure the actual capture size so we can convert pixel coords → canvas units.
        const captureSize = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = base64;
        });
        const ptc = bgW / captureSize.w; // pixels-to-canvas scale factor

        const croppedClean = await cropToRegion(
          cleanDiff,
          boundingBox.x,
          boundingBox.y,
          boundingBox.w,
          boundingBox.h
        );
        const croppedGhost = await applyAlpha(croppedClean, 0.55);

        const shapeX = bgX + boundingBox.x * ptc;
        const shapeY = bgY + boundingBox.y * ptc;
        const shapeW = boundingBox.w * ptc;
        const shapeH = boundingBox.h * ptc;

        const assetId = AssetRecordType.createId();
        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "diff.png",
              src: croppedGhost,
              w: boundingBox.w,
              h: boundingBox.h,
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
          x: shapeX,
          y: shapeY,
          opacity: 0,
          isLocked: false,
          props: { w: shapeW, h: shapeH, assetId },
        });

        const newUpdate: PendingUpdate = {
          id: crypto.randomUUID(),
          diffPng: croppedClean,
          boundingBox: { x: shapeX, y: shapeY, w: shapeW, h: shapeH },
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
    <div
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        cursor: mode === "draw" ? "url('/pencil.png') 0 31, crosshair" : "default",
      }}
    >
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
