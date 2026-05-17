# Contracts

Single source of truth for cross-module interfaces. Change one → announce in
the group chat first. Every module depends on this file.

> The types below are also **real code** in `shared/types.ts` — import from
> there, never hand-redefine. This doc is the human explanation; that file is
> what compiles. Keep the two in sync.

## Ports

| Port  | Service                                  | Owner |
|-------|------------------------------------------|-------|
| 3000  | orchestrator (AgentPhone + whiteboard webhooks) | P1 |
| 3001  | whiteboard canvas app                    | P4    |
| 5173  | Vite dev server — the live site          | P3    |

`codegen` is **not** a server. The orchestrator imports it and calls
`applyEdit()` directly.

## File layout on disk

```
data/{businessId}/
  profile.json          business profile (below)
  state.json            state machine: { phase, siteVitePort, ... }
  uploads/              raw product photos from iMessage
  whiteboard/           composited annotated PNGs
  screenshots/          current site screenshots (for whiteboard background)
sites/{businessId}/     clone of /template, its own git repo, Vite runs here
```

Demo uses `businessId = "demo"` throughout.

## Business profile — `data/{businessId}/profile.json`

```json
{
  "businessId": "demo",
  "name": "Rose & Thorn",
  "type": "florist",
  "vibe": ["cozy", "modern"],
  "colors": ["#2d5016", "#f5f0e1"],
  "tagline": "Fresh arrangements, made daily",
  "products": [
    { "name": "Spring Bouquet", "price": 4500, "image": "/products/spring.png" }
  ],
  "contact": { "phone": "", "address": "", "hours": "" },
  "sections": ["hero", "products", "about", "contact", "order"]
}
```

- `price` is in **cents** (Stripe convention).
- `image` paths are relative to the site's `public/` dir.
- Orchestrator owns writing this file. Codegen reads it; never writes it.

## State machine — `data/{businessId}/state.json`

```
INTAKE ──► BUILDING ──► REVISING ──► LIVE ──► OPERATING
```

- `INTAKE` — orchestrator collecting answers on the call.
- `BUILDING` — first codegen pass running.
- `REVISING` — accepting voice + whiteboard edits.
- `LIVE` — owner confirmed; Stripe Checkout active.
- `OPERATING` — inbound calls now route to the merchant ops agent.

## Codegen API (library, imported by orchestrator)

```ts
applyEdit(req: EditRequest): Promise<EditResult>

type EditRequest = {
  businessId: string;
  instruction: string;        // voice transcript or text
  whiteboardPng?: string;     // path to annotated PNG, optional
  currentScreenshot?: string; // path, optional
};

type EditResult = {
  ok: boolean;
  summary: string;            // human-readable, spoken back to the owner
  committed: boolean;         // true if the site git repo got a new commit
  error?: string;
};
```

`buildInitialSite(businessId)` does the first pass: clone `/template` →
`sites/{id}/`, apply the profile, `git init`, start Vite.

## Orchestrator HTTP endpoints (:3000)

| Method | Path                          | From            | Body |
|--------|-------------------------------|-----------------|------|
| POST   | `/webhook/agentphone/call`    | AgentPhone      | call event / transcript chunk |
| POST   | `/webhook/agentphone/imessage`| AgentPhone      | text + attachment URLs |
| POST   | `/webhook/whiteboard`         | whiteboard app  | `{ businessId, pngBase64 }` |
| GET    | `/api/profile?b={id}`         | whiteboard app  | returns `profile.json` |
| GET    | `/api/screenshot?b={id}`      | whiteboard app  | returns current screenshot PNG |

AgentPhone payload shapes are vendor-defined — P1 normalizes them into the
shapes above so no other module sees raw AgentPhone JSON.

## Whiteboard flow

1. Orchestrator texts the owner: `http://<ngrok>/whiteboard?b=demo`
   (whiteboard app is proxied or the link points at :3001 directly on the demo
   machine).
2. App loads, calls `GET /api/screenshot?b=demo`, sets it as the Excalidraw
   canvas background.
3. Owner draws. On submit, app composites canvas + background → PNG → `POST
   /webhook/whiteboard`.
4. Orchestrator calls `applyEdit({ businessId, instruction: "see whiteboard",
   whiteboardPng })`.

## Screenshot util (`infra/`)

```ts
captureSite(businessId: string): Promise<string>  // returns PNG path
```

Playwright against `localhost:5173`. Used by the whiteboard background and by
codegen to give the vision model "before" context.

## Environment variables

All pulled via `stripe projects env --pull`. Never commit `.env`.

```
ANTHROPIC_API_KEY=
AGENTPHONE_API_KEY=             # AgentPhone dashboard, Bearer token
AGENTPHONE_WEBHOOK_SECRET=      # issued when the webhook is created; HMAC verify
STRIPE_SECRET_KEY=              # test mode
STRIPE_PUBLISHABLE_KEY=         # test mode
GEMINI_API_KEY=
```

`agent_id` / `number_id` / iMessage line id are not secrets — created via
AgentPhone API calls, keep them in a config file or env, the orchestrator's
choice.
