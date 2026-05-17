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

## AgentPhone integration

- Base URL `https://api.agentphone.ai/v1`. Bearer `AGENTPHONE_API_KEY`.
- **Agent number: +1 252-713-4488** — owners call this to build; customers call
  the same number in Act 2. Demo from the whitelisted contact only.
- Account starts with $5 free credit. Redeem the hackathon codes for numbers:
  `SENDAMESSAGE` (SMS number, skips A2P 10DLC), `AP2IMSG` (shared iMessage line
  — whitelist your own contact after redeeming).
- Create **one** agent with `voiceMode: "webhook"`. Hosted mode is wrong for us:
  it uses AgentPhone's own LLM and never reaches our codegen.
- One master webhook URL → ngrok → :3000. Verify the HMAC signature
  (`x-webhook-signature`, `x-webhook-timestamp`) with `AGENTPHONE_WEBHOOK_SECRET`.
- Inbound events are all `agent.message` — switch on `channel`:
  - `voice` — call transcript turn → intake / revision conversation
  - `imessage` / `mms` — text or product photos (media attachments)
  - `agent.call_ended` — full transcript + analysis when a call ends
- Outbound iMessage with images uses `media_urls` — **public HTTPS URLs only**.
  localhost will not work. Serve product images and the whiteboard link through
  the ngrok tunnel.
- Inbound calling is in hackathon testing — only the whitelisted contact can
  call. Demo from that phone.

## Interfaces

- Imports `codegen`: `buildInitialSite()`, `applyEdit()`.
- Reads/writes `data/{id}/profile.json` and `state.json` (you own both).
- `codegen` reads the profile — never writes it.

## Do not

- Do not edit site files directly — that is `codegen`'s job.
- Do not block the webhook response on a slow edit; ack fast, work async.
- Do not invent new fields in `profile.json` without updating
  `docs/CONTRACTS.md` first.
