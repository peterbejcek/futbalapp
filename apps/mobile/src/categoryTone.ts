import { categoryColor } from '@fkknv/shared';
import { ui } from '@/theme';

/** Zmieša farbu `hex` (#rrggbb) s `base` (#rrggbb) v pomere `ratio` (0–1 = podiel `hex`). */
function mix(hex: string, base: string, ratio: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(base);
  const out = a.map((v, i) => Math.round(v * ratio + b[i]! * (1 - ratio)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Farby kategórie družstva pre tmavé pozadie (ako apps/web/src/lib/colors.ts):
 * pozadie = ~36 % pastelovej farby kategórie zmiešané s panelom, text = pastelová farba.
 */
export function categoryTone(code: string | null | undefined): { bg: string; text: string } {
  const p = categoryColor(code);
  const bg = /^#[0-9a-f]{6}$/i.test(p.bg) ? mix(p.bg, ui.panel, 0.36) : ui.panel2;
  return { bg, text: p.bg };
}
