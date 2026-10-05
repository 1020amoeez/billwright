import { headingFor, type Look, type LookFont } from './look';
import { templates } from '~/data/templates';

/**
 * Instant, offline reading of simple style requests ("make it blue", "serif",
 * "minimal"). It applies before the AI answers, and is all there is when AI is
 * not configured. Anything it cannot read is left to /api/style.
 */

const COLOURS: Record<string, string> = {
  red: '#DC2626',
  crimson: '#B91C1C',
  maroon: '#7F1D1D',
  orange: '#F97316',
  amber: '#FFB020',
  gold: '#D4A017',
  yellow: '#FACC15',
  lime: '#84CC16',
  green: '#16A34A',
  emerald: '#059669',
  teal: '#0D9488',
  mint: '#34D399',
  cyan: '#06B6D4',
  sky: '#0EA5E9',
  blue: '#2563EB',
  navy: '#1E3A8A',
  indigo: '#4F46E5',
  purple: '#9333EA',
  violet: '#7C3AED',
  lavender: '#A78BFA',
  pink: '#EC4899',
  magenta: '#C026D3',
  rose: '#E11D48',
  brown: '#92400E',
  beige: '#D6C3A5',
  grey: '#6B7280',
  gray: '#6B7280',
  black: '#111111',
  charcoal: '#36454F',
};

const FONTS: [RegExp, LookFont][] = [
  [/\b(serif|classic font|elegant|times|georgia|formal)\b/, 'serif'],
  [/\b(mono|monospace|typewriter|code font|courier)\b/, 'mono'],
  [/\b(sans|sans-serif|modern font|clean font)\b/, 'sans'],
];

export interface LocalLook {
  look: Partial<Look>;
  template?: string;
  logo?: 'bigger' | 'smaller' | 'hide' | 'show';
  watermark?: boolean;
  /** True when the request contained nothing this parser understood. */
  empty: boolean;
}

export function readLookLocally(text: string): LocalLook {
  const lower = text.toLowerCase();
  const look: Partial<Look> = {};
  let template: string | undefined;

  const hex = lower.match(/#[0-9a-f]{6}\b/);
  const word = Object.keys(COLOURS).find((name) => new RegExp(`\\b${name}\\b`).test(lower));
  const accent = hex ? hex[0].toUpperCase() : word ? COLOURS[word] : undefined;
  if (accent) {
    look.accent = accent;
    look.heading = headingFor(accent);
  }

  for (const [pattern, font] of FONTS) {
    if (pattern.test(lower)) {
      look.font = font;
      break;
    }
  }

  for (const t of templates) {
    if (lower.includes(t.name.toLowerCase()) || lower.includes(t.id)) template = t.id;
  }
  if (!template && /\b(dark|bold) (header|top|band)\b/.test(lower)) template = 'bold-header';

  // "watermark" is handled on its own so "add a logo watermark" does not also resize the logo.
  let watermark: boolean | undefined;
  if (/\bwater ?mark\b/.test(lower)) {
    watermark = !/\b(no|remove|hide|without|drop|off|turn off)\b/.test(lower);
  }

  let logo: LocalLook['logo'];
  if (watermark === undefined && /\b(logo|initials|mark)\b/.test(lower)) {
    if (/\b(hide|remove|no|without|drop)\b/.test(lower)) logo = 'hide';
    else if (/\b(bigger|larger|big|large|increase)\b/.test(lower)) logo = 'bigger';
    else if (/\b(smaller|small|tiny|decrease)\b/.test(lower)) logo = 'smaller';
    else if (/\b(show|add|bring back)\b/.test(lower)) logo = 'show';
  }

  const empty = !accent && !look.font && !template && !logo && watermark === undefined;
  return { look, template, logo, watermark, empty };
}
