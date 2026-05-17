# merchant-agent/ — owner P4

Act 2. Once the site is built, this agent answers **inbound customer calls**
about the business. Minimal by design.

## Scope

- Triggered when the orchestrator routes a call and the business state is
  `OPERATING` (same AgentPhone number, routed by state).
- Loads `data/{businessId}/profile.json` as context.
- Answers customer questions: hours, location, what they sell, prices,
  "are you open", "do you do weddings", etc.
- Conversational, friendly, speaks as the business.

## Interface

- Exposes `handleCall(businessId, transcript)` → reply text, imported by the
  orchestrator. Not a server.
- Read-only on `profile.json`.

## Do not — keep it minimal

- No order taking, no booking pipeline, no payment handling.
- No CRM, no lead storage, no calendar.
- No new data files. Profile in, spoken answer out.

If a customer wants to buy, point them to the website's Order button. That is
the whole job for the demo.
