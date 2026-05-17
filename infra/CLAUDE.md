# infra/ — owner P3

Glue: Stripe Projects setup, secrets, the screenshot util, and run scripts.
No application logic here.

## Stripe Projects CLI

This is our devops backbone and a sponsor story — "we provisioned and shared
our whole stack through Stripe Projects."

- `stripe projects init chasm` — done once, commit `.projects/state.json`.
- `stripe projects add <provider>/<service>` — provision anything we host
  through a provider (optional for a localhost demo; mainly used for the
  shared-secrets story).
- `stripe projects env --pull` — every teammate runs this to get `.env`.
- `.projects/state.local.json` is gitignored (per-developer resource IDs).

Document the exact commands the team ran in `infra/SETUP.md` so anyone can
reproduce the environment.

## Screenshot util

```ts
captureSite(businessId: string): Promise<string>  // returns PNG path
```

- Playwright against `localhost:5173`. Save to `data/{id}/screenshots/`.
- Used by the whiteboard background and by codegen's vision input.

## Run scripts

- `npm run dev` at repo root — start orchestrator (:3000), whiteboard (:3001),
  and the active site (:5173) together.
- A script to remind/start `ngrok http 3000`.

## .gitignore (own this)

```
node_modules/
.env
.projects/state.local.json
data/
sites/
dist/
```

## Do not

- No business logic in `infra/` — utilities and scripts only.
- Never commit `.env` or live Stripe keys. Test mode only.
