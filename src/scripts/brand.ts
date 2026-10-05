/**
 * The business's mark: an uploaded logo, or initials when there is none.
 *
 * It belongs to the business rather than to one document, so it is stored
 * once under its own key and shared by invoices, quotations and receipts, and
 * "Start a new invoice" leaves it alone. The image never leaves the browser.
 */

export type LogoSize = 'small' | 'medium' | 'large';

export interface Brand {
  /** A downscaled PNG or JPEG data URL, or null for initials. */
  logo: string | null;
  /** Width over height of the logo, for layout before the image loads. */
  ratio: number;
  size: LogoSize;
  /** False hides the mark entirely, logo or initials. */
  show: boolean;
  /** A large faint copy of the logo behind the sheet. Needs an uploaded logo. */
  watermark: boolean;
}

export const logoSizes: LogoSize[] = ['small', 'medium', 'large'];

export const defaultBrand: Brand = {
  logo: null,
  ratio: 1,
  size: 'medium',
  show: true,
  watermark: false,
};

/** Faint enough that text over it reads normally, in print and on screen. */
export const WATERMARK_OPACITY = 0.07;

/** Mark heights in points for the PDF; the preview's live in paper.css. */
export const pdfMarkHeight: Record<LogoSize, number> = { small: 26, medium: 36, large: 50 };

const KEY = 'billwright:brand';

/** Longest side kept after upload: about 4x the printed size, so it stays sharp. */
const MAX_SIDE = 480;
const MAX_UPLOAD = 5 * 1024 * 1024;

export function loadBrand(): Brand {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultBrand };
    const parsed = JSON.parse(raw) as Partial<Brand>;
    const logo =
      typeof parsed.logo === 'string' && /^data:image\/(png|jpeg);base64,/.test(parsed.logo)
        ? parsed.logo
        : null;
    return {
      logo,
      ratio: typeof parsed.ratio === 'number' && parsed.ratio > 0 ? parsed.ratio : 1,
      size: logoSizes.includes(parsed.size as LogoSize) ? (parsed.size as LogoSize) : 'medium',
      show: parsed.show !== false,
      watermark: parsed.watermark === true,
    };
  } catch {
    return { ...defaultBrand };
  }
}

/** False when the browser refused to store it (private mode, or storage full). */
export function saveBrand(brand: Brand): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(brand));
    return true;
  } catch {
    return false;
  }
}

/** "Meridian Studio" → "MS", "acme" → "A". Empty when there is no name yet. */
export function initialsOf(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s&-]/gu, '')
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = src;
  });
}

/**
 * Reads an uploaded file into a small data URL. SVGs are rasterised, because
 * the PDF library only embeds PNG and JPEG; photos stay JPEG to keep them small.
 */
export async function prepareLogo(file: File): Promise<{ src: string; ratio: number }> {
  if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) {
    throw new Error('Use a PNG, JPG, SVG or WebP image.');
  }
  if (file.size > MAX_UPLOAD) throw new Error('That image is over 5 MB. Try a smaller one.');

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // An SVG without width and height reports zero; treat it as square.
    const w0 = img.naturalWidth || MAX_SIDE;
    const h0 = img.naturalHeight || MAX_SIDE;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot process images.');
    ctx.drawImage(img, 0, 0, w, h);

    const src =
      file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
    return { src, ratio: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The logo's main colour, for "Match logo colours". Greys, whites and near
 * blacks are ignored, and vivid colours outweigh dull ones, so a red logo on a
 * white square gives red. Null for a logo with no real colour in it.
 */
export async function logoColour(src: string): Promise<string | null> {
  const img = await loadImage(src);
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<number, { weight: number; r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (max < 40 || saturation < 0.25) continue;

    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 };
    bucket.weight += saturation;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  let best: { weight: number; r: number; g: number; b: number; n: number } | undefined;
  for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket;
  // A few stray anti-aliased pixels are not a brand colour.
  if (!best || best.n < 8) return null;

  const hex = [best.r, best.g, best.b]
    .map((sum) => Math.round(sum / best!.n).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex.toUpperCase()}`;
}
