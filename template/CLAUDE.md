# template/ — owner P3

The base website. Gets cloned into `sites/{businessId}/` per business, then
edited by `codegen`. Vite + React + TypeScript + Tailwind.

## Design principle: data-driven

All copy, colors, products, and contact info live in **`src/content.ts`** as a
typed object shaped like the business profile. Components render from it.
Codegen edits `content.ts` for content changes — low risk of breaking the
build. Only layout/style changes touch component JSX.

```
template/
  src/
    content.ts         typed site content, mirrors profile.json
    components/
      Hero.tsx
      Products.tsx     reads content.products, renders cards
      About.tsx
      Contact.tsx
      OrderButton.tsx  Stripe Checkout (test mode)
      Footer.tsx
    App.tsx            composes components in content.sections order
    theme.ts           color tokens from content.colors
  public/
    products/          product images land here
  index.html
  vite.config.ts       dev server on :5173
```

## Component rules

- Every section is a **named component** — codegen edits by name. Keep names
  stable and obvious.
- Components must render safely from partial data (no product images yet,
  empty contact, etc.). No crashes on missing fields.
- Tailwind only — no CSS files. Colors via `theme.ts` tokens.

## Stripe Checkout

- `OrderButton.tsx` hits a Checkout Session created server-side (small endpoint
  — coordinate with P1 on where it lives, or a tiny route in this app).
- **Test mode only.** Keys from `.env` via Stripe Projects. Never hardcode.

## Do not

- Do not add a router or extra pages — single-page site for the demo.
- Do not commit `node_modules` or built output.
- Do not break the named-component contract — codegen depends on it.
