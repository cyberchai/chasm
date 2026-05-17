# Infra Setup — Stripe Projects CLI

Step-by-step reproduction for any teammate.

## Prerequisites

- [Stripe CLI](https://docs.stripe.com/stripe-cli) installed
- Projects plugin: `stripe plugin install projects`

## One-time setup (team lead)

```bash
# 1. Initialize the project
stripe projects init chasm

# 2. Add Stripe payments (provisions test-mode keys)
stripe projects add stripe/payments

# 3. Commit the project state (NOT local state)
git add .projects/state.json
git commit -m "chore: init stripe projects"
```

## Every teammate

```bash
# Pull shared secrets into .env
stripe projects env --pull

# This populates:
#   STRIPE_SECRET_KEY=sk_test_...
#   STRIPE_PUBLISHABLE_KEY=pk_test_...
#   ANTHROPIC_API_KEY=...
#   AGENTPHONE_API_KEY=...
#   AGENTPHONE_WEBHOOK_SECRET=...
#   GEMINI_API_KEY=...
```

## What gets gitignored

- `.env` — secrets (pulled via `stripe projects env --pull`)
- `.projects/state.local.json` — per-developer resource IDs
- `data/` — runtime business data
- `sites/` — cloned site instances

## Adding more services

```bash
stripe projects catalog                     # browse available services
stripe projects add <provider>/<service>    # provision a service
stripe projects env --pull                  # refresh .env
```

## Verifying setup

```bash
stripe projects status    # shows all provisioned resources
cat .env | head -5        # confirm keys are populated (never share these)
```

## Sponsor story

> "We provisioned and shared our whole stack through Stripe Projects.
> One command (`stripe projects env --pull`) and every teammate has
> every key they need. No Slack DMs, no shared password managers."
