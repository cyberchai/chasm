# Chasm

**Call to create. Agents to operate.** A phone-first website builder for local
businesses. A business owner calls a number, describes their business, and a
website is generated and revised live. After it is built, an agent stays
attached to handle inbound customer calls.

This is a hackathon project. **Localhost demo only — no cloud, no deploy.**

---

## The demo loop (locked — do not re-scope)

1. Owner calls the AgentPhone number. Agent asks ~3 questions (vibe, colors,
   what they sell).
2. Orchestrator builds a **business profile** and triggers codegen.
3. Codegen clones `/template` into `sites/{businessId}/`, fills it from the
   profile. Vite dev server serves it on `localhost:5173`.
4. Owner texts product photos over iMessage. Photos land in the Products
   section.
5. Agent texts a **whiteboard link**. Owner draws edits on top of a screenshot
   of their own site. The annotated PNG drives an incremental edit.
6. Owner speaks more edits ("darker green", "more premium"). HMR shows each
   change in ~1–2 s.
7. Generated site has a working Stripe Checkout "Order" button (test mode).
8. **Act 2:** site flips to "operate" mode. Calling the number now reaches the
   **merchant ops agent**, which answers customer questions from the profile.

## Architecture

```
Call + iMessage ──► AgentPhone ──► ngrok ──► orchestrator (:3000)
                                                 │
                profile.json ◄──────────────────┤  builds business profile
                                                 │
                                                 ▼
                                       codegen (library call)
                                                 │  Claude Agent SDK
                                                 │  edits sites/{id}/ components
                                                 ▼
                                  Vite dev server (:5173) ──► HMR ──► demo screen
                                                 ▲
whiteboard app (:3001) ──► annotated PNG ────────┘
```

- **Codegen is a library, not a server** — the orchestrator imports and calls
  it. Fewer moving servers.
- **One active business for the demo** (`businessId = "demo"`). Data shapes keep
  `businessId` so multi-business is possible later, but do not build it now.

## Stack

| Concern            | Choice                                            |
|--------------------|---------------------------------------------------|
| Phone + iMessage   | AgentPhone (sponsor)                              |
| Webhook tunnel     | ngrok → orchestrator :3000                        |
| Orchestrator brain | Claude (conversation + profile extraction)        |
| Codegen            | Claude Agent SDK editing a Vite project           |
| Site template      | Vite + React + TypeScript + Tailwind              |
| Live preview       | Vite dev server + HMR on :5173                    |
| Whiteboard         | Excalidraw embed, site screenshot as background   |
| Screenshots        | Playwright (local, in-process util)               |
| Payments           | Stripe Checkout (test mode) in the generated site |
| Secrets / env      | Stripe Projects CLI (`env --pull`) (sponsor)      |
| Product images     | Gemini / nano-banana image gen + cleanup          |

## Repo map and owners

| Dir              | What                                          | Owner |
|------------------|-----------------------------------------------|-------|
| `orchestrator/`  | AgentPhone webhooks, conversation state machine, profile extraction, ngrok | P1 |
| `codegen/`       | Claude Agent SDK edit loop, whiteboard PNG ingestion, build-safety | P2 |
| `template/`      | Vite/React/Tailwind starter, named components, Stripe Checkout | P3 |
| `infra/`         | Stripe Projects config, secrets, screenshot util, run scripts | P3 |
| `whiteboard/`    | Excalidraw canvas app (:3001)                 | P4 |
| `merchant-agent/`| Post-launch inbound ops agent                 | P4 |

Each dir has its own `CLAUDE.md` with the detail for its owner.

## Shared contracts

**Read `docs/CONTRACTS.md` before writing any cross-module code.** It is the
single source of truth for data shapes, HTTP endpoints, ports, and the
`data/` + `sites/` file layout. Changing a contract = tell the team in the
group chat first.

## How to run (dev)

```bash
stripe projects env --pull        # pull shared secrets into .env
npm install                       # at repo root (workspaces)
npm run dev                       # starts orchestrator + whiteboard + a site
ngrok http 3000                   # paste the URL into the AgentPhone dashboard
```

## Conventions

- TypeScript everywhere. Node for services, React for the site/whiteboard.
- No secrets in git. All keys come from `stripe projects env --pull` → `.env`.
  `.env` and `.projects/state.local.json` are gitignored.
- Each `sites/{id}/` dir is its own git repo: codegen commits after every
  successful edit so a broken edit can be reverted.
- Small PRs. Branch per module. `main` always demoable.
- Conventional commits (`feat:`, `fix:`, `chore:`).

## Scope guardrails — do NOT build

- No cloud deploy, no VM, no Vercel. Localhost only.
- No multi-business concurrency. One business at a time.
- No auth, no accounts, no database — JSON files on disk.
- Merchant ops agent stays minimal (answer questions). No order/booking
  pipelines, no CRM.
- MPP / agentic-commerce protocol is a pitch slide, not code.

See `docs/PLAN.md` for the phased plan and demo script.
