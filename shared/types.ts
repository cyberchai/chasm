// shared/types.ts
//
// Canonical cross-module types — the contracts in docs/CONTRACTS.md as code.
// Every module imports from here. NEVER hand-redefine these in your module.
// Changing a type = announce in the group chat, same as editing CONTRACTS.md.

export type BusinessId = string;

/** Business lifecycle. See docs/CONTRACTS.md and docs/FLOW.md. */
export type Phase = "INTAKE" | "BUILDING" | "REVISING" | "LIVE" | "OPERATING";

export interface Product {
  name: string;
  /** Price in cents (Stripe convention). */
  price: number;
  /** Path relative to the site's public/ dir, e.g. "/products/spring.png". */
  image: string;
}

export interface Contact {
  phone: string;
  address: string;
  hours: string;
}

/** Written by the orchestrator → data/{businessId}/profile.json.
 *  Read-only everywhere else. */
export interface BusinessProfile {
  businessId: BusinessId;
  name: string;
  type: string;
  vibe: string[];
  /** Hex strings or named colors. */
  colors: string[];
  tagline: string;
  products: Product[];
  contact: Contact;
  /** Section render order, e.g. ["hero","products","about","contact","order"]. */
  sections: string[];
}

/** data/{businessId}/state.json — owned by the orchestrator. */
export interface BusinessState {
  businessId: BusinessId;
  phase: Phase;
  /** Vite dev server port for this business's site (5173 for the demo). */
  siteVitePort: number;
}

/** Input to codegen.applyEdit(). */
export interface EditRequest {
  businessId: BusinessId;
  /** Voice transcript or text instruction. */
  instruction: string;
  /** Path to an annotated whiteboard PNG, when the edit came from the canvas. */
  whiteboardPng?: string;
  /** Path to a current site screenshot, for vision "before" context. */
  currentScreenshot?: string;
}

/** Output of codegen.applyEdit() and buildInitialSite(). */
export interface EditResult {
  ok: boolean;
  /** Human-readable — spoken back to the owner. */
  summary: string;
  /** True if the site's git repo got a new commit. */
  committed: boolean;
  error?: string;
}

/** Body of POST /webhook/whiteboard. */
export interface WhiteboardSubmission {
  businessId: BusinessId;
  pngBase64: string;
}
