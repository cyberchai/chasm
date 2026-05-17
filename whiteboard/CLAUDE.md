# whiteboard/ — owner P4

The visual-edit surface. A small web app on **:3001** where the owner draws
edits on top of a screenshot of their own site.

## Flow

1. Owner opens `…/whiteboard?b=demo` (link texted by the orchestrator).
2. App calls `GET /api/screenshot?b=demo` on the orchestrator → current site
   screenshot.
3. Screenshot is set as the **Excalidraw canvas background**. The owner draws
   on top — circles, arrows, text notes.
4. On submit, composite the screenshot + drawn annotations into one PNG.
5. `POST /webhook/whiteboard` to the orchestrator with
   `{ businessId, pngBase64 }`.

## Why background matters

A blank canvas gives the vision model nothing to anchor to. With the real site
as the background, every mark sits on top of a component the model can see —
"circle around the hero + arrow + 'bigger'" becomes unambiguous. Do not ship a
blank-canvas version.

## Build notes

- Embed **Excalidraw** (`@excalidraw/excalidraw`). Use its API to set the
  background image and to export the scene as PNG.
- Keep it one page. No accounts, no save/load.
- Big obvious "Send to agent" button.

## Do not

- Do not call `codegen` directly — always go through the orchestrator webhook.
- Do not build layers/accept-deny UI — one annotated PNG per submit is enough.
