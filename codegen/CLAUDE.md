# codegen/ — owner P2

The package that turns a profile + an instruction into edited site code. A
**library**, not a server — the orchestrator imports it.

> Detailed build plan: `codegen/PLAN.md`. Edit-agent system prompt:
> `codegen/prompts/edit-agent.md`.

## Public API (see `docs/CONTRACTS.md` for types)

- `buildInitialSite(businessId)` — clone `/template` → `sites/{id}/`, apply
  `profile.json`, `git init` + first commit, start the Vite dev server, return
  an `EditResult`.
- `applyEdit(req)` — apply one voice/whiteboard instruction to `sites/{id}/`.

## How edits work

- Use the **Claude Agent SDK** pointed at `sites/{id}/`.
- Give the model: the instruction, the list of named components, the relevant
  component source, and — when present — the whiteboard PNG and the current
  screenshot as vision input.
- The whiteboard PNG is a screenshot of the real site with the owner's
  annotations drawn on top — tell the model the marks are spatially anchored to
  the components it can see.

## Build-safety (critical)

1. `sites/{id}/` is a git repo. Commit after every successful edit.
2. After an edit, run a build/typecheck check (`tsc --noEmit` or `vite build`).
3. On failure, `git reset --hard` to the last good commit and return
   `ok: false` with the error. The demo must never show a broken site.

## Prefer data edits over structural edits

`/template` is data-driven. Most content changes ("add a product", "change the
tagline") should edit `src/content.ts`, not component JSX. Only touch
components / Tailwind for layout and style changes. This keeps the build green.

## Do not

- Do not write `profile.json` — read-only from here.
- Do not run a server or open ports.
- Do not leave a site in a broken state — always revert.
