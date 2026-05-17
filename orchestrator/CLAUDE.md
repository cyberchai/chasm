# orchestrator/ — owner P1

The brain. Receives every AgentPhone event, runs the conversation, owns the
business profile and state machine, and drives codegen.

## Responsibilities

- HTTP server on **:3000** with the endpoints in `docs/CONTRACTS.md`.
- Normalize AgentPhone payloads — no other module ever sees raw vendor JSON.
- Run the intake conversation with Claude: ask vibe / colors / what they sell,
  keep it to ~3 questions.
- Extract and write `data/{businessId}/profile.json`.
- Own `data/{businessId}/state.json` and the state machine
  `INTAKE → BUILDING → REVISING → LIVE → OPERATING`.
- Call `buildInitialSite()` and `applyEdit()` from the `codegen` package.
- Route inbound calls: builder flow vs `merchant-agent` based on state.
- Send the whiteboard link over iMessage when the owner wants visual edits.

## Key flows

- **Call in:** webhook → if state `OPERATING`, hand to `merchant-agent`;
  else run intake / revision conversation.
- **iMessage in:** text → treat as an edit instruction or a command. Attachments
  → save to `data/{id}/uploads/`, hand image handling to P4's pipeline.
- **Edit:** speak a short ack immediately, call `applyEdit()` async, speak the
  returned `summary` when it resolves.

## Interfaces

- Imports `codegen`: `buildInitialSite()`, `applyEdit()`.
- Reads/writes `data/{id}/profile.json` and `state.json` (you own both).
- `codegen` reads the profile — never writes it.

## Do not

- Do not edit site files directly — that is `codegen`'s job.
- Do not block the webhook response on a slow edit; ack fast, work async.
- Do not invent new fields in `profile.json` without updating
  `docs/CONTRACTS.md` first.
