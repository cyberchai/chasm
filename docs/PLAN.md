# Plan

Phased build for the Chasm hackathon demo. Each phase ends in something
runnable. `main` stays demoable at all times.

## Team split

| Person | Owns                                                            |
|--------|-----------------------------------------------------------------|
| P1     | `orchestrator/` — AgentPhone webhooks, conversation state machine, profile extraction, ngrok, call routing |
| P2     | `codegen/` — Claude Agent SDK edit loop, whiteboard PNG ingestion, build-safety |
| P3     | `template/` — Vite/React site, data-driven `content.ts`, Stripe Checkout, screenshot util |
| P4     | `whiteboard/` — full focus, end to end. Then `merchant-agent/` + image gen in Phase 5. |

`infra/` (Stripe Projects init, secrets, `.gitignore`, run scripts) is **Phase
0, done together** — not one person's job.

P1 and P2 are the critical path (call → live site). P3 and P4 finish their
pieces earlier, then pair onto whichever of P1/P2 is behind.

### Dependency order

- P3 ships a **barebones `/template`** in Phase 1 first — P2's `codegen` has
  nothing to clone until it exists. Enrich the template after.
- P1 normalizes AgentPhone payloads on day 1 — unblocks everyone downstream.
- P4's whiteboard is not on the critical path until Phase 3 — runway to build
  it well.

## Phase 0 — Setup (everyone, first)

- `stripe projects init chasm`; `stripe projects add` for any provisioned
  services; commit `.projects/state.json`.
- Each person runs `stripe projects env --pull` → shared `.env`.
- Repo scaffold: npm workspaces, TypeScript config, `.gitignore`
  (`.env`, `.projects/state.local.json`, `data/`, `sites/`, `node_modules/`).
- Claim an AgentPhone number; P1 wires the ngrok tunnel.
- Agree on `docs/CONTRACTS.md` — no code crosses a module before it is signed
  off.

## Phase 1 — Skeleton pipe (demo-critical)

Goal: prove the pipe end to end with fakes.

- P1: orchestrator HTTP server, a `POST /test/build` route that writes a
  hardcoded `profile.json`.
- P2: `buildInitialSite()` clones `/template` → `sites/demo/`, applies the
  profile, starts Vite.
- P3: `/template` renders a florist site from a `content.ts` object.
- **Exit:** hitting `/test/build` produces a real site on `localhost:5173`.

## Phase 2 — Real intake

- P1: AgentPhone call webhook → conversation loop with Claude → asks the ~3
  intake questions → extracts a real `profile.json` → calls
  `buildInitialSite()`.
- State machine: `INTAKE → BUILDING → REVISING`.
- **Exit:** a real phone call produces a real site.

## Phase 3 — Edit loop (demo-critical)

- P2: `applyEdit()` — Claude Agent SDK reads `sites/demo/`, applies a voice
  instruction, commits on success, reverts on build failure.
- P4: whiteboard app — Excalidraw embed, screenshot background, export
  composite PNG, POST to orchestrator.
- P2: whiteboard PNG path flows into `applyEdit()` as vision input.
- **Exit:** voice edit and whiteboard edit both change the live site.

## Phase 4 — Images + payments

- P1: iMessage webhook saves product photos to `data/demo/uploads/`.
- P4: Gemini cleans/standardizes photos; codegen places them in the Products
  section.
- P3: Stripe Checkout — `/template` has an "Order" button hitting a Checkout
  Session (test mode).
- **Exit:** texted photos appear on the site; the Order button charges a test
  card.

## Phase 5 — Act 2 + polish

- P4: merchant ops agent — when state is `OPERATING`, inbound calls reach an
  agent that answers from `profile.json`.
- P1: state flips to `LIVE` then `OPERATING` on owner confirmation.
- Everyone: rehearse the demo script, fix the rough edges, freeze `main`.

## Demo script (~3–4 min)

1. Call the number: "I run Rose & Thorn, a florist."
2. Agent asks vibe / colors / what you sell. Site v1 appears on screen.
3. Text two flower photos over iMessage → they show up in Products.
4. Agent texts the whiteboard link. Circle the hero, write "bigger + add
   tagline" → submit → site updates.
5. Speak: "make it more premium, darker green" → updates live.
6. Click the Order button → Stripe Checkout, pay with a test card.
7. "Your shop now has a worker." Call the number again as a customer → the
   ops agent answers questions about Rose & Thorn.

## Risks and mitigations

| Risk                                    | Mitigation                                  |
|-----------------------------------------|---------------------------------------------|
| Codegen breaks the Vite build           | Commit per good edit; revert on build fail. Make `/template` data-driven so most edits touch `content.ts`. |
| Vision model misreads the whiteboard    | Background is the real site screenshot, so marks are spatially anchored. Pass component names + code with the image. |
| AgentPhone webhook latency / flakiness  | P1 normalizes payloads; keep `/test/build` and a typed-text fallback so the demo never depends on a live call. |
| Voice round-trip feels slow             | Speak a short ack immediately; apply the edit async; HMR shows the result. |
| Scope creep                             | Follow the guardrails in `CLAUDE.md`. One business, no deploy, no DB. |

## Is this a good idea? (honest take)

Yes — for a hackathon it is strong: visual, live, clear sponsor fit
(AgentPhone as the interface, Stripe Projects as the devops story, Stripe
Checkout as a real outcome). The only real failure mode is scope. The win
condition is the **call → live site → whiteboard edit** loop landing cleanly.
Everything else (merchant agent, images, MPP) is a bonus act. Protect the core
loop first.
