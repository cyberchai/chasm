# codegen/ — execution plan (P2)

Detailed build plan for the `codegen` package. Read `../CLAUDE.md` and
`../docs/CONTRACTS.md` first — this plan assumes those contracts.

## What this package is

A **library** the orchestrator imports. Two public functions (types in
`shared/types.ts`):

- `buildInitialSite(businessId): Promise<EditResult>` — first build.
- `applyEdit(req: EditRequest): Promise<EditResult>` — one incremental edit.

No server, no ports.

## Tech choice — Claude Agent SDK

Use **`@anthropic-ai/claude-agent-sdk`** (headless Claude Code as a library) —
NOT the Anthropic Messages SDK. Reasons:

- Built-in `Read` / `Edit` / `Write` / `Glob` / `Grep` / `Bash` tools — exactly
  what editing a Vite project needs. No hand-rolled tool loop.
- Runs the agentic loop internally; prompt caching of system prompt + tool
  defs is handled for you.
- `cwd` option points it at `sites/{businessId}/` — it edits files in place,
  Vite HMR picks them up.

Model: **`claude-opus-4-7`**, effort **`xhigh`** (best for coding/agentic work).
Verify exact `query()` option names against the `@anthropic-ai/claude-agent-sdk`
README — that is task one of Phase 1, do not guess the signature.

## Module layout

```
codegen/
  package.json            own deps — claude-agent-sdk, the shared types
  src/
    index.ts              exports buildInitialSite, applyEdit
    buildInitial.ts       deterministic first build (no LLM)
    applyEdit.ts          the Agent SDK edit loop
    agent.ts              query() wrapper — options, system prompt, vision input
    profileToContent.ts   profile.json → template content.ts (pure transform)
    siteProcess.ts        spawn / track the Vite dev server
    git.ts                init / commit / revert helpers for sites/{id}/
    buildCheck.ts         tsc --noEmit gate
    queue.ts              serialize edits per business (one at a time)
  prompts/
    edit-agent.md         system prompt for the edit agent (already drafted)
  test/
    fixtures/profile.json a florist profile for standalone testing
    harness.ts            CLI: build + edit without the orchestrator
```

## Phase 1 — buildInitialSite (demo-critical)

First build is **deterministic — no LLM call.** Fast, reliable, no failure mode.

1. Read `data/{businessId}/profile.json`.
2. Copy `/template` → `sites/{businessId}/` (exclude `node_modules`).
3. `profileToContent.ts`: serialize the profile into the template's
   `src/content.ts` shape. Pure function, no model.
4. `npm install` in the site dir (once; cache for the demo).
5. `git init` + initial commit (`git.ts`).
6. Start `vite dev` on port 5173 (`siteProcess.ts`), keep the process handle.
7. Return `EditResult { ok, summary, committed: true }`.

**Exit:** calling `buildInitialSite("demo")` yields a live site on :5173.
Depends on P3 shipping a barebones `/template` first — coordinate day 1.

## Phase 3 — applyEdit (demo-critical)

The edit loop. One instruction → edited site → HMR.

1. `queue.ts` — serialize: only one `applyEdit` per business at a time. Queue
   if the owner talks fast.
2. Capture a current screenshot via the `infra` screenshot util (for vision
   context) if `currentScreenshot` not supplied.
3. `agent.ts` — call the Agent SDK `query()`:
   - `cwd` = `sites/{businessId}/`
   - `allowedTools` = `Read, Edit, Write, Glob, Grep` (no `Bash` for edits —
     keeps it from running arbitrary commands; build-check is run by us).
   - `systemPrompt` = contents of `prompts/edit-agent.md` (see below).
   - prompt content = the instruction text + image blocks for the whiteboard
     PNG and current screenshot when present.
4. After the agent finishes: `buildCheck.ts` runs `tsc --noEmit`.
5. Pass → `git.ts` commits. Fail → `git reset --hard HEAD`, return `ok: false`.
6. Return `EditResult` with a one-line `summary` for the orchestrator to speak.

HMR shows the change automatically — Vite watches `sites/{id}/`.

## Build-safety (non-negotiable)

- `sites/{id}/` is a git repo. Commit after every green edit.
- `tsc --noEmit` after every edit. Revert on failure. The demo never shows a
  broken site.
- Bias edits toward `src/content.ts` (data) over component JSX — see the
  template's data-driven design in `../template/CLAUDE.md`. The system prompt
  enforces this.

## Prompt caching

The Agent SDK caches the system prompt + tool definitions internally. To keep
the cache warm across edits:

- **Keep `prompts/edit-agent.md` frozen** — never interpolate per-edit content
  (instruction text, timestamps, business name) into the system prompt.
- Per-edit content goes in the **prompt** (user turn): the instruction, the
  images, the component file list.

That ordering (stable system prompt, volatile prompt) is what makes repeated
edits cheap and fast.

## Vision / whiteboard input

- Pass the whiteboard PNG and current screenshot as **image content blocks** in
  the `query()` prompt.
- The whiteboard PNG is the real site screenshot with the owner's annotations
  drawn on top — tell the agent (in the system prompt) the marks are spatially
  anchored to the components it can see.
- Opus 4.7 has automatic high-res vision — good for reading handwritten notes.
  No flag needed.

## Standalone testing — do not wait for the orchestrator

`test/harness.ts` — a CLI so P2 develops fully independently:

```
npm run codegen:build demo                       # uses test/fixtures/profile.json
npm run codegen:edit demo "make it darker green"
npm run codegen:edit demo --whiteboard ./test/fixtures/wb.png
```

This is how P2 stays off the critical path's critical path. Build against the
fixture; integrate with P1 continuously, not at the end.

## Risks

| Risk | Mitigation |
|------|------------|
| Agent breaks the Vite build | `tsc --noEmit` gate + git revert. Bias to `content.ts` edits. |
| Agent edits the wrong component | Named components + screenshot + whiteboard anchoring; pass the component file list in the prompt. |
| `npm install` per site is slow | Install once for the demo; one business only. |
| Edit races (fast talker) | `queue.ts` serializes per business. |
| Agent SDK option names guessed wrong | Phase 1 task one: verify against the `@anthropic-ai/claude-agent-sdk` README. |
