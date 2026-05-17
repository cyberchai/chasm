# Whiteboard App — CLAUDE.md

## Role in the system

This app is one module in a larger pipeline. Its only jobs are:

1. Load the current site screenshot as the canvas background (`GET /api/screenshot?b={businessId}`)
2. Let the user draw a mockup and iterate on it with AI suggestions
3. On submit, send the final flattened PNG to the orchestrator (`POST /webhook/whiteboard` with `{ businessId, pngBase64 }`)

Everything else — codegen, voice calls, the live site — is handled by other modules. Do not reach outside these two endpoints.

`businessId` comes from the URL query param: `?b=demo`. Read it on load and thread it through both API calls.

---

## Stack

- **Next.js** (App Router, port 3001)
- **tldraw** — canvas
- **OpenRouter** → `google/gemini-3-pro-image-preview` — AI image editing
- **shadcn/ui + TailwindCSS** — UI
- **React state** — all app state (no Supabase, no persistence needed)

---

## Environment variables

```
OPENROUTER_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3001
ORCHESTRATOR_URL=http://localhost:3000
```

---

## Application modes

The app has exactly two modes. Mode transitions are automatic.

### DRAW mode
- Canvas is fully interactive (`editor.updateInstanceState({ isReadonly: false })`)
- User can draw freely
- Chat panel is enabled
- Viewport is user-controlled
- Active when the update stack is empty

### REVIEW mode
- Canvas is locked (`editor.updateInstanceState({ isReadonly: true })`)
- Viewport is app-controlled (zoomed to current diff)
- Chat input is disabled
- Tab → accept top update, Delete/Backspace → reject top update
- Active when the update stack has one or more items
- On stack empty → unlock canvas, zoom out to full canvas, return to DRAW mode

These are the only two states. There is no in-between. Never allow drawing while updates are pending.

---

## File structure

```
src/
  app/
    page.tsx                        # Entry: reads ?b=, loads screenshot, renders layout
    board/page.tsx                  # Main canvas page
    api/
      suggest/route.ts              # POST — Gemini image edit via OpenRouter
      chat/route.ts                 # POST — chat model with canvas vision
  components/
    Canvas.tsx                      # tldraw wrapper + all canvas logic
    UpdateStack.tsx                 # Left sidebar: pending update cards
    ChatPanel.tsx                   # Right sidebar: chat thread + input
    StatusIndicator.tsx             # Top-center generating/success/error badge
  hooks/
    usePixelDiff.ts                 # Pixel diff + bounding box computation
    useKeyboardReview.ts            # Tab / Delete keybindings for review mode
    useDebounceActivity.ts          # Fires callback after N ms of canvas inactivity
  lib/
    orchestrator.ts                 # submitFinalPng() — POST to /webhook/whiteboard
    openrouter.ts                   # callGemini() — shared fetch wrapper
  utils/
    imageProcessing.ts              # correctYellowedWhites() pixel post-processing
```

---

## Data shapes

```ts
// One pending AI update
type PendingUpdate = {
  id: string;                  // crypto.randomUUID()
  diffPng: string;             // base64 data URL — transparent background, only changed pixels
  boundingBox: {               // canvas coordinates of changed region
    x: number;
    y: number;
    w: number;
    h: number;
  };
  prompt: string;              // the chat message that triggered this
  shapeId: TLShapeId;          // tldraw shape ID of the placed diff image
};

// Chat message
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  canvasSnapshot?: string;     // base64 screenshot attached to user messages
};
```

---

## Canvas setup (`components/Canvas.tsx`)

```tsx
import {
  Tldraw, useEditor, createShapeId, AssetRecordType,
  DefaultColorThemePalette, type TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";

// Force white background in both light and dark mode
DefaultColorThemePalette.lightMode.background = "#FFFFFF";
DefaultColorThemePalette.darkMode.background = "#FFFFFF";

<Tldraw
  components={{ MenuPanel: null, NavigationPanel: null, HelperButtons: null }}
  onMount={(editor) => {
    loadScreenshotAsBackground(editor, screenshotUrl);
  }}
>
  <CanvasController
    mode={mode}
    pendingUpdates={pendingUpdates}
    onAccept={handleAccept}
    onReject={handleReject}
  />
</Tldraw>
```

`CanvasController` is a component rendered inside `<Tldraw>` that calls `useEditor()`. Pass mode and handlers as props; never pass the editor instance up.

### Loading the screenshot as background

```ts
async function loadScreenshotAsBackground(editor: Editor, url: string) {
  const img = new Image();
  img.src = url;
  await new Promise(r => img.onload = r);

  const assetId = AssetRecordType.createId();
  editor.createAssets([{
    id: assetId, type: 'image', typeName: 'asset',
    props: { name: 'background.png', src: url, w: img.width, h: img.height,
             mimeType: 'image/png', isAnimated: false },
    meta: {},
  }]);

  const shapeId = createShapeId();
  editor.createShape({
    id: shapeId, type: 'image',
    x: 0, y: 0,
    isLocked: true,
    props: { w: img.width, h: img.height, assetId },
  });

  editor.zoomToFit({ animation: { duration: 0 } });
}
```

---

## AI suggestion flow

### Step 1 — Screenshot canvas (excluding pending diffs)

```ts
const shapesToCapture = [...editor.getCurrentPageShapeIds()]
  .filter(id => !pendingUpdates.map(u => u.shapeId).includes(id));

const { blob } = await editor.toImage(shapesToCapture, {
  format: 'png',
  bounds: editor.getViewportPageBounds(),
  background: true, scale: 1, padding: 0,
});

const base64 = await blobToBase64(blob);
```

Always exclude pending diff shapes from the capture. They must not feed back into the next generation.

Store this screenshot in `lastScreenshotRef.current` before sending to Gemini — the pixel diff needs the pre-Gemini state.

### Step 2 — API route: `src/app/api/suggest/route.ts`

```ts
POST /api/suggest
Body: { image: string, prompt: string }
Response: { imageUrl: string | null, textContent: string }
```

```ts
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL,
    'X-Title': 'Whiteboard App',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-pro-image-preview',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: buildPrompt(prompt) },
      ],
    }],
    modalities: ['image', 'text'],  // REQUIRED — enables image output from Gemini
    reasoning_effort: 'minimal',
  }),
});
```

System prompt (always include, non-negotiable):
```
You are helping design a website mockup. The user has drawn a wireframe.
CRITICAL:
- DO NOT remove, modify, move, or touch ANY existing content in the image.
- Leave everything exactly as it is and ONLY ADD to it.
- Draw all additions in a clean wireframe style.
- Keep the background pure white.
- Match the user's sketchy/wireframe aesthetic.
Additional instruction: {prompt}
```

Extract the returned image URL from the response — check `message.images[0].url`, then scan `content` array for `type: 'image_url'`, then fall back to scanning string content for a data URL pattern.

### Step 3 — Pixel diff (`hooks/usePixelDiff.ts`)

Run entirely client-side after the Gemini response arrives. No extra API call. Runs in ~5-15ms.

```ts
export function computeDiff(
  originalBase64: string,
  geminiBase64: string,
  threshold = 15
): Promise<{ diffBase64: string; boundingBox: BoundingBox }> {
  return new Promise((resolve) => {
    const origImg = new Image();
    const gemImg = new Image();

    origImg.onload = () => {
      gemImg.onload = () => {
        const W = origImg.width, H = origImg.height;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(origImg, 0, 0);
        const origData = ctx.getImageData(0, 0, W, H);

        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(gemImg, 0, 0);
        const gemData = ctx.getImageData(0, 0, W, H);

        const out = ctx.createImageData(W, H);
        let minX = W, minY = H, maxX = 0, maxY = 0;
        let hasChanges = false;

        for (let i = 0; i < origData.data.length; i += 4) {
          const dr = Math.abs(origData.data[i]   - gemData.data[i]);
          const dg = Math.abs(origData.data[i+1] - gemData.data[i+1]);
          const db = Math.abs(origData.data[i+2] - gemData.data[i+2]);
          const delta = Math.max(dr, dg, db);

          if (delta >= threshold) {
            out.data[i]   = gemData.data[i];
            out.data[i+1] = gemData.data[i+1];
            out.data[i+2] = gemData.data[i+2];
            out.data[i+3] = 255;

            const px = (i / 4) % W;
            const py = Math.floor((i / 4) / W);
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
            hasChanges = true;
          } else {
            out.data[i+3] = 0; // transparent
          }
        }

        ctx.putImageData(out, 0, 0);
        const diffBase64 = canvas.toDataURL('image/png');

        const PADDING = 40;
        const boundingBox = hasChanges
          ? { x: minX - PADDING, y: minY - PADDING,
              w: (maxX - minX) + PADDING * 2, h: (maxY - minY) + PADDING * 2 }
          : { x: 0, y: 0, w: W, h: H };

        resolve({ diffBase64, boundingBox });
      };
      gemImg.src = geminiBase64;
    };
    origImg.src = originalBase64;
  });
}
```

### Step 4 — Place diff on canvas

```ts
// Apply yellow-white correction first
const cleanDiff = await correctYellowedWhites(diffBase64);

const assetId = AssetRecordType.createId();
const viewportBounds = editor.getViewportPageBounds();

editor.createAssets([{
  id: assetId, type: 'image', typeName: 'asset',
  props: {
    name: 'diff.png', src: cleanDiff,
    w: viewportBounds.width, h: viewportBounds.height,
    mimeType: 'image/png', isAnimated: false,
  },
  meta: {},
}]);

const shapeId = createShapeId();
editor.createShape({
  id: shapeId, type: 'image',
  x: viewportBounds.x, y: viewportBounds.y,
  opacity: 0.85,
  isLocked: true,
  props: { w: viewportBounds.width, h: viewportBounds.height, assetId },
});
```

Add a `PendingUpdate` to the stack with the shapeId and bounding box, then immediately enter REVIEW mode.

### Step 5 — Zoom to diff bounding box

Called whenever a new update becomes the top of the stack (on add, or after accept/reject):

```ts
function zoomToDiff(editor: Editor, boundingBox: BoundingBox) {
  editor.zoomToBounds(
    { x: boundingBox.x, y: boundingBox.y, w: boundingBox.w, h: boundingBox.h },
    { animation: { duration: 400 }, inset: 32 }
  );
}
```

When stack empties:
```ts
editor.zoomToFit({ animation: { duration: 400 } });
```

---

## Review mode — accept / reject

### Accept (Tab key)

```ts
function handleAccept(shapeId: TLShapeId) {
  isUpdatingRef.current = true;

  // Unlock to update opacity, then re-lock
  editor.updateShape({ id: shapeId, type: 'image', isLocked: false, opacity: 1 });
  editor.updateShape({ id: shapeId, type: 'image', isLocked: true });

  setPendingUpdates(prev => prev.filter(u => u.shapeId !== shapeId));
  setTimeout(() => { isUpdatingRef.current = false; }, 100);
}
```

### Reject (Delete / Backspace key)

```ts
function handleReject(shapeId: TLShapeId) {
  isUpdatingRef.current = true;

  editor.updateShape({ id: shapeId, type: 'image', isLocked: false });
  editor.deleteShape(shapeId);

  setPendingUpdates(prev => prev.filter(u => u.shapeId !== shapeId));
  setTimeout(() => { isUpdatingRef.current = false; }, 100);
}
```

### After each accept/reject

```ts
useEffect(() => {
  if (pendingUpdates.length === 0) {
    editor.updateInstanceState({ isReadonly: false });
    editor.zoomToFit({ animation: { duration: 400 } });
    setMode('draw');
  } else {
    zoomToDiff(editor, pendingUpdates[0].boundingBox);
  }
}, [pendingUpdates]);
```

### Keyboard bindings (`hooks/useKeyboardReview.ts`)

```ts
useEffect(() => {
  if (mode !== 'review') return;

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onAccept(pendingUpdates[0].shapeId);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onReject(pendingUpdates[0].shapeId);
    }
  };

  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [mode, pendingUpdates, onAccept, onReject]);
```

### isUpdatingRef guard

All accept/reject operations set `isUpdatingRef.current = true` before touching the editor and reset after 100ms. Any `editor.store.listen()` callbacks must check this ref and early-return if true. Prevents shape mutations from triggering the inactivity debounce or being treated as user edits.

---

## Chat panel (`components/ChatPanel.tsx` + `src/app/api/chat/route.ts`)

### Behavior

- Right sidebar, always visible
- Input disabled during REVIEW mode (`mode === 'review'`)
- On send: screenshot canvas, attach as vision input, send full message history to chat API
- On response: if `shouldGenerate` is true, automatically trigger suggestion generation using the user's message as the prompt
- Otherwise: display text reply only

### API route: `src/app/api/chat/route.ts`

```ts
POST /api/chat
Body: { messages: ChatMessage[], canvasSnapshot: string }
Response: { reply: string, shouldGenerate: boolean }
```

```ts
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'system',
        content: `You are a website design assistant helping a user refine their website mockup.
The user is drawing wireframes on a canvas. You can see the current canvas state in each message.
When the user asks for a visual change, describe what you will do and set shouldGenerate: true.
When the user asks a question or wants to discuss, respond conversationally and set shouldGenerate: false.
Always respond in JSON only: { "reply": string, "shouldGenerate": boolean }`
      },
      ...formattedMessages,  // see below
    ],
    response_format: { type: 'json_object' },
  }),
});
```

Format messages for the API — include canvas snapshot on every user turn:
```ts
const formattedMessages = messages.map(m => m.role === 'user'
  ? { role: 'user', content: [
      { type: 'image_url', image_url: { url: m.canvasSnapshot } },
      { type: 'text', text: m.content },
    ]}
  : { role: 'assistant', content: m.content }
);
```

### Frontend send flow

```ts
async function handleSend(text: string) {
  // 1. Screenshot current canvas
  const snapshot = await captureCanvas(editor);

  // 2. Add user message to history
  const userMsg: ChatMessage = { id: uuid(), role: 'user', content: text, canvasSnapshot: snapshot };
  setMessages(prev => [...prev, userMsg]);

  // 3. Call chat API with full history
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: [...messages, userMsg], canvasSnapshot: snapshot }),
    headers: { 'Content-Type': 'application/json' },
  });
  const { reply, shouldGenerate } = await res.json();

  // 4. Add assistant reply
  setMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: reply }]);

  // 5. Trigger visual suggestion if needed
  if (shouldGenerate) {
    await generateSuggestion(text);
  }
}
```

---

## Submit flow

When the user clicks Submit (only available in DRAW mode, stack must be empty):

```ts
async function handleSubmit() {
  editor.updateInstanceState({ isReadonly: true });

  const shapeIds = [...editor.getCurrentPageShapeIds()];
  const { blob } = await editor.toImage(shapeIds, {
    format: 'png', background: true, scale: 1,
  });
  const base64 = await blobToBase64(blob);

  await fetch(`${process.env.ORCHESTRATOR_URL}/webhook/whiteboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId, pngBase64: base64 }),
  });

  // Show confirmation UI. Do not unlock canvas.
}
```

Submit button is disabled during REVIEW mode and during any active generation.

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  [← Back]                [status badge]      [Submit]   │
├──────────────┬──────────────────────────┬───────────────┤
│              │                          │               │
│  Update      │                          │   Chat        │
│  Stack       │     tldraw canvas        │   Panel       │
│  (left)      │                          │   (right)     │
│  ~260px      │     fills remaining      │   ~300px      │
│              │                          │               │
│  Tab=accept  │                          │  [disabled    │
│  Del=reject  │                          │   in review]  │
└──────────────┴──────────────────────────┴───────────────┘
```

- Canvas: `position: fixed; inset: 0` within its column
- Status badge: absolute, top-center of canvas
- Submit: top-right, disabled in REVIEW mode and while generating

---

## Update stack card (`components/UpdateStack.tsx`)

Each card displays:
- Thumbnail of the diff PNG (small, ~80px tall)
- The prompt text that triggered it (truncated to 2 lines)
- "Tab to accept · Delete to reject" hint — only on the top card
- Cards below the top are dimmed (queued, not yet active)

Cards are not individually clickable. Review is always sequential top-down. This is intentional.

---

## Key invariants — never violate these

1. Never generate while in REVIEW mode. Check `mode === 'review'` at the top of `generateSuggestion` and return early.
2. Never let the user edit in REVIEW mode. `isReadonly: true` must be set the moment a diff lands on the canvas.
3. Always exclude pending diff shapes from canvas screenshots. Filter by `pendingUpdates.map(u => u.shapeId)` before calling `editor.toImage()`.
4. Always store `lastScreenshotRef.current` before sending to Gemini. The diff needs the pre-Gemini canvas state.
5. Always set `isUpdatingRef.current = true` during accept/reject operations. Prevents store listener feedback loops.
6. Chat input must be disabled in REVIEW mode. User cannot queue new prompts while reviewing.
7. Submit disabled in REVIEW mode and during active generation. The final PNG must reflect only accepted changes.

---

## Image post-processing (`utils/imageProcessing.ts`)

Apply `correctYellowedWhites()` to the diff PNG before placing it on the canvas. Gemini sometimes tints white areas slightly yellow. This corrects it by pushing near-white pixels (all channels ≥ 240) to pure white. Client-side only, ~5ms.

```ts
export async function correctYellowedWhites(imageUrl: string, threshold = 240): Promise<string>
```

---

## What this app does NOT do

- No persistence (no Supabase, no localStorage, no DB)
- No voice agent (chat panel is the interface; voice is a future drop-in replacement)
- No codegen
- No site preview
- No auth
- Does not write `profile.json` or `state.json`
- Does not call any orchestrator endpoint except `POST /webhook/whiteboard` on final submit