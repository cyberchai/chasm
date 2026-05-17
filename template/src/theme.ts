// theme.ts — Derives CSS custom properties from content.colors
// Called once on mount. Components read colors via Tailwind's brand-* tokens.

import { content } from './content';

/** Convert hex to HSL components for manipulation */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s, l };
}

/** Convert HSL back to hex */
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h / 360 + 1 / 3);
  const g = hue2rgb(p, q, h / 360);
  const b = hue2rgb(p, q, h / 360 - 1 / 3);

  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply theme colors derived from the business's color palette.
 * Sets CSS custom properties on :root so Tailwind brand-* tokens resolve.
 */
export function applyTheme(): void {
  const [primaryHex = '#2d5016', secondaryHex = '#f5f0e1'] = content.colors;

  const primary = hexToHSL(primaryHex);
  const accentHex = hslToHex(primary.h, Math.min(primary.s * 1.2, 1), Math.min(primary.l * 1.4, 0.5));

  const vars: Record<string, string> = {
    '--color-primary': primaryHex,
    '--color-secondary': secondaryHex,
    '--color-accent': accentHex,
    '--color-surface': '#0e0e0e',
    '--color-surface-alt': '#1a1a1a',
    '--color-text': secondaryHex,
    '--color-text-muted': hslToHex(primary.h, 0.08, 0.62),
    '--color-border': '#2a2a2a',
  };

  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
