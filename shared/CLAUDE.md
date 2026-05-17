# shared/ — no single owner

Canonical TypeScript types — the contracts in `docs/CONTRACTS.md` as real
code. This is the seam that keeps four people's modules fitting together.

## Rules

- **Import these types. Never hand-redefine them in your module.** A duplicated
  `EditResult` that drifts is the #1 integration bug.
- Changing a type = announce in the group chat first, same as editing
  `docs/CONTRACTS.md`. Keep the two in sync.
- Types only. No logic, no runtime code, no dependencies.

## Files

- `types.ts` — `BusinessProfile`, `BusinessState`, `Phase`, `EditRequest`,
  `EditResult`, `WhiteboardSubmission`, etc.

Import example:

```ts
import type { EditRequest, EditResult } from "../shared/types";
```
