/**
 * The customisable look of a document: two colours and a type family.
 * Shared by the preview, the PDF export and the /api/style function, so the
 * same readability rules apply wherever a colour comes from.
 */

export type LookFont = 'sans' | 'serif' | 'mono';

export interface Look {
  /** Decoration only: the brand mark, accent rules, the contractor cap. */
  accent: string;
  /** Title, table rule and totals. Always dark enough to read on white. */
  heading: string;
  font: LookFont;
}

export const lookFonts: LookFont[] = ['sans', 'serif', 'mono'];

export const defaultLook: Look = { accent: '#FFB020', heading: '#151A28', font: 'sans' };

/** Font stacks for the preview. The PDF maps the same keys to its standard fonts. */
export const fontStacks: Record<LookFont, { body: string; display: string } | null> = {
  sans: null, // the site's own Plex / Bricolage pair
  serif: {
    body: "Georgia, 'Times New Roman', Times, serif",
    display: "Georgia, 'Times New Roman', Times, serif",
  },
  mono: {
    body: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    display: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of a colour against white paper. */
export function contrastOnWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** Darkens a colour, keeping its hue, until it clears the contrast target on white. */
export function darkenTo(hex: string, target: number): string {
  let rgb = hexToRgb(hex);
  let out = hex.toUpperCase();
  for (let i = 0; i < 40 && contrastOnWhite(out) < target; i++) {
    rgb = rgb.map((v) => v * 0.9) as [number, number, number];
    out = rgbToHex(rgb);
  }
  return out;
}

/**
 * Cleans a look from any source (storage, the API, a colour picker).
 * The heading carries text on white and white text on top of it in some
 * templates, so it is held to 7:1 either way.
 */
export function normaliseLook(input: Partial<Look> | undefined, base: Look = defaultLook): Look {
  const accent = isHex(input?.accent) ? input.accent.toUpperCase() : base.accent;
  const rawHeading = isHex(input?.heading) ? input.heading : base.heading;
  const font = lookFonts.includes(input?.font as LookFont) ? (input!.font as LookFont) : base.font;
  return { accent, heading: darkenTo(rawHeading, 7), font };
}

/** A heading colour in the same family as an accent: "make it blue" turns both blue. */
export function headingFor(accent: string): string {
  return darkenTo(accent, 9);
}

/** Ink or white, whichever reads better on a fill: initials sit on the accent. */
export function textOn(fill: string): string {
  const onWhite = contrastOnWhite(fill); // white text on this fill
  const onInk = (luminance(fill) + 0.05) / (luminance('#151A28') + 0.05);
  return onWhite >= onInk ? '#FFFFFF' : '#151A28';
}
