# AgentPhone Integration

Chasm uses AgentPhone as the phone and messaging layer for the localhost demo. Owners can call, SMS, MMS, or iMessage the AgentPhone number, and the orchestrator normalizes every inbound turn into a `ChasmBuilderCommand`. Voice uses AgentPhone webhook mode so Chasm controls the spoken response and builder workflow.

Chasm does not use a native iOS app or private Apple iMessage APIs. iOS texting comes through AgentPhone `imessage`, `sms`, or `mms` channels.

## Environment

Get an API key from the AgentPhone dashboard, then pull or add these variables to `.env`:

```bash
AGENTPHONE_API_KEY=
AGENTPHONE_AGENT_ID=
AGENTPHONE_NUMBER_ID=
AGENTPHONE_WEBHOOK_SECRET=
AGENTPHONE_WEBHOOK_URL=
AGENTPHONE_AREA_CODE=
CHASM_PUBLIC_APP_URL=
CHASM_PREVIEW_BASE_URL=
```

Do not commit real secrets. `AGENTPHONE_AGENT_ID` and `AGENTPHONE_NUMBER_ID` are not secrets, but keeping them in `.env` makes the setup script idempotent.

## Setup

Install dependencies at the repo root:

```bash
npm install
```

Expose the orchestrator on port 3000 with a tunnel:

```bash
npm run dev
ngrok http 3000
```

Set `CHASM_PUBLIC_APP_URL` or pass the webhook URL directly. Local webhook example:

```bash
npm run chasm:agentphone:setup -- --webhook-url https://<tunnel-domain>/api/agentphone/webhook
```

Production-style URL shape:

```bash
https://<app-domain>/api/agentphone/webhook
```

Optional flags:

```bash
npm run chasm:agentphone:setup -- --area-code 415
npm run chasm:agentphone:setup -- --agent-name Chasm
npm run chasm:agentphone:setup -- --dry-run
```

The setup script creates or updates a Chasm agent with `voiceMode: "webhook"`, provisions or reuses a number, attaches that number to the agent, and configures a per-agent webhook. If per-agent webhook setup fails, it falls back to the project webhook and logs that behavior.

After setup, copy the printed values into `.env`:

```bash
AGENTPHONE_AGENT_ID=
AGENTPHONE_NUMBER_ID=
AGENTPHONE_WEBHOOK_SECRET=
AGENTPHONE_WEBHOOK_URL=
```

## Testing

Start the orchestrator:

```bash
npm run dev
```

Then test the live AgentPhone path:

- Send SMS/iMessage/MMS to the provisioned number.
- Call the number and speak a site change.
- Use the AgentPhone webhook test endpoint if available in the dashboard/API.

Local automated checks:

```bash
npm test
npm run typecheck
npm run lint
```

## Troubleshooting

- Invalid signature: check `AGENTPHONE_WEBHOOK_SECRET` and confirm the route verifies the raw body before JSON parsing.
- Caller hears silence: the voice webhook must return JSON or NDJSON immediately; Chasm streams an interim NDJSON chunk first.
- Duplicate messages: persistent idempotency is missing or misconfigured. The current implementation uses a dev in-memory store with a production TODO.
- Outbound SMS fails: AgentPhone/account carrier registration or compliance may be required for outbound SMS. Inbound SMS and voice are separate from outbound carrier requirements.
