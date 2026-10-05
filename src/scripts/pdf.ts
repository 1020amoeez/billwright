import type { DocState, Totals } from './store';
import { parseAmount, formatAmount, formatMoney, formatQty, formatDate } from './format';
import { copyFor } from './paper';
import { defaultLook, hexToRgb, normaliseLook, textOn } from './look';
import { defaultBrand, initialsOf, pdfMarkHeight, WATERMARK_OPACITY, type Brand } from './brand';

/**
 * pdf-lib's standard fonts are WinAnsi-encoded, so anything outside that set
 * has to be folded down before it is drawn or the library throws.
 */
function winAnsi(text: string): string {
  return String(text ?? '')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\xFF]/g, '');
}

export interface PdfOptions {
  taxLabel: string;
  taxRate: number;
  brand?: Brand;
}

function dataUrlBytes(src: string): Uint8Array {
  const binary = atob(src.slice(src.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

export async function buildPdf(
  state: DocState,
  totals: Totals,
  opts: PdfOptions,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const doc = await PDFDocument.create();
  let page = doc.addPage([A4.w, A4.h]);
  // The three standard PDF families line up with the look's three fonts.
  const look = normaliseLook(state.look ?? defaultLook);
  const family = {
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold],
  }[look.font];
  const regular = await doc.embedFont(family[0]);
  const bold = await doc.embedFont(family[1]);
  const fromHex = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return rgb(r / 255, g / 255, b / 255);
  };

  const ink = rgb(0.082, 0.102, 0.157); // #151A28
  const muted = rgb(0.4, 0.44, 0.541); // #66708A
  const line = rgb(0.902, 0.91, 0.937); // #E6E8EF
  const accent = fromHex(look.accent);
  const heading = fromHex(look.heading);
  const white = rgb(1, 1, 1);

  const c = copyFor[state.kind];
  const isLedger = state.template === 'ledger';
  const title = isLedger && state.kind === 'invoice' ? 'Tax invoice' : c.title;
  const cur = state.currency;
  const right = A4.w - MARGIN;

  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    font = regular,
    color = ink,
  ) => page.drawText(winAnsi(value), { x, y, size, font, color });

  const textRight = (
    value: string,
    x: number,
    y: number,
    size: number,
    font = regular,
    color = ink,
  ) => {
    const safe = winAnsi(value);
    page.drawText(safe, { x: x - font.widthOfTextAtSize(safe, size), y, size, font, color });
  };

  const rule = (y: number, thickness: number, color = line) =>
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: right, y },
      thickness,
      color,
    });

  // The mark: uploaded logo, else initials on the accent (not on Minimal).
  const brand = opts.brand ?? defaultBrand;
  const logo =
    (brand.show || brand.watermark) && brand.logo
      ? brand.logo.startsWith('data:image/jpeg')
        ? await doc.embedJpg(dataUrlBytes(brand.logo))
        : await doc.embedPng(dataUrlBytes(brand.logo))
      : null;
  const initials =
    brand.show && !logo && state.template !== 'minimal' ? winAnsi(initialsOf(state.businessName)) : '';

  // pdf-lib paints in call order, so the watermark goes on each sheet before anything else.
  const drawWatermark = (sheet: typeof page) => {
    if (!logo || !brand.watermark) return;
    let w = 330;
    let h = w / brand.ratio;
    if (h > 360) {
      h = 360;
      w = h * brand.ratio;
    }
    sheet.drawImage(logo, {
      x: (A4.w - w) / 2,
      y: (A4.h - h) / 2,
      width: w,
      height: h,
      opacity: WATERMARK_OPACITY,
    });
  };
  drawWatermark(page);

  /** Draws the mark flush right with its top at `top`; returns its height, or 0. */
  const drawMark = (top: number, maxHeight: number, onDark: boolean): number => {
    if (!brand.show) return 0;
    let h = Math.min(pdfMarkHeight[brand.size], maxHeight);
    if (logo) {
      let w = h * brand.ratio;
      if (w > 150) {
        w = 150;
        h = w / brand.ratio;
      }
      if (onDark) {
        // The same white chip as the preview, so dark logos show on the band
        page.drawRectangle({ x: right - w - 8, y: top - h - 4, width: w + 8, height: h + 8, color: white });
        page.drawImage(logo, { x: right - w - 4, y: top - h, width: w, height: h });
      } else {
        page.drawImage(logo, { x: right - w, y: top - h, width: w, height: h });
      }
      return h;
    }
    if (!initials) return 0;
    page.drawRectangle({ x: right - h, y: top - h, width: h, height: h, color: accent });
    const size = h * 0.38;
    const width = bold.widthOfTextAtSize(initials, size);
    page.drawText(initials, {
      x: right - h / 2 - width / 2,
      y: top - h / 2 - size * 0.35,
      size,
      font: bold,
      color: fromHex(textOn(look.accent)),
    });
    return h;
  };

  let y = A4.h - MARGIN;

  // Header band for the templates that have one
  if (state.template === 'bold-header') {
    page.drawRectangle({ x: 0, y: y - 46, width: A4.w, height: 78, color: heading });
    text(title, MARGIN, y - 12, 26, bold, white);
    text(
      `No. ${state.number || '0001'}   ${c.dateLabel} ${formatDate(state.issueDate)}`,
      MARGIN,
      y - 32,
      9.5,
      regular,
      rgb(0.75, 0.78, 0.84),
    );
    // Centred in the band, which runs from y - 46 to y + 32
    const cap = logo ? 32 : 40; // a logo also has its chip's padding
    drawMark(y - 7 + Math.min(pdfMarkHeight[brand.size], cap) / 2, cap, true);
    y -= 78;
  } else {
    if (state.template === 'contractor') {
      page.drawRectangle({ x: 0, y: A4.h - 10, width: A4.w, height: 10, color: accent });
    }
    text(title, MARGIN, y - 26, 28, bold, heading);
    text(
      `No. ${state.number || '0001'}   ${c.dateLabel} ${formatDate(state.issueDate)}`,
      MARGIN,
      y - 44,
      9.5,
      regular,
      muted,
    );
    const markHeight = drawMark(y, 60, false);
    const nameY = y - (markHeight ? markHeight + 14 : 14);
    textRight(state.businessName || 'Your business', right, nameY, 10, bold);
    y -= Math.max(72, markHeight + 34);
  }

  if (isLedger) {
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: right, y: y + 6 },
      thickness: 2,
      color: accent,
    });
    y -= 6;
  }

  // Parties
  const colB = MARGIN + (right - MARGIN) / 2;
  text('From', MARGIN, y, 9.5, regular, muted);
  text(state.kind === 'receipt' ? 'Received from' : 'Bill to', colB, y, 9.5, regular, muted);
  y -= 15;
  text(state.businessName || '[Your business]', MARGIN, y, 11, bold);
  text(state.clientName || '[Client name]', colB, y, 11, bold);
  y -= 14;
  text(state.businessAddress || '[Your address]', MARGIN, y, 10, regular, muted);
  text(`${c.dueLabel} ${formatDate(state.dueDate)}`, colB, y, 10, regular, muted);
  if (state.businessEmail) {
    y -= 13;
    text(state.businessEmail, MARGIN, y, 10, regular, muted);
  }
  y -= 34;

  // Table
  const colQty = right - 300;
  const colUnit = right - 190;
  const colAmount = right;
  const pages = [page];
  const BOTTOM = MARGIN + 34; // clear space kept for the footer line

  const drawTableHead = () => {
    rule(y + 14, 2, heading);
    text('Description', MARGIN, y, 9.5, regular, muted);
    textRight('Qty', colQty, y, 9.5, regular, muted);
    textRight('Unit price', colUnit, y, 9.5, regular, muted);
    textRight('Amount', colAmount, y, 9.5, regular, muted);
    y -= 10;
    rule(y, 1);
    y -= 20;
  };

  const breakPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    drawWatermark(page);
    pages.push(page);
    y = A4.h - MARGIN - 10;
  };

  drawTableHead();

  const items = state.items.filter(
    (item) => item.description.trim() || parseAmount(item.unitPrice),
  );

  for (const item of items) {
    // Every row is carried onto a new sheet rather than dropped, so the lines
    // always add up to the total printed at the end.
    if (y < BOTTOM + 30) {
      breakPage();
      drawTableHead();
    }
    const amount = parseAmount(item.qty) * parseAmount(item.unitPrice);
    text(item.description || 'Item', MARGIN, y, 10.5);
    textRight(formatQty(parseAmount(item.qty)), colQty, y, 10.5);
    textRight(formatAmount(parseAmount(item.unitPrice), cur), colUnit, y, 10.5);
    textRight(formatAmount(amount, cur), colAmount, y, 10.5);
    y -= 12;
    rule(y, 1);
    y -= 20;
  }

  // Totals need roughly 110pt of clear space to sit together.
  if (y < BOTTOM + 110) breakPage();

  // Totals — labels left-aligned in a block, values flush right, as on screen
  y -= 14;
  const totalsLeft = right - 225;
  textRight('Subtotal', totalsLeft + 60, y, 10, regular, muted);
  textRight(formatMoney(totals.subtotal, cur), right, y, 10, regular, muted);
  y -= 16;

  if (totals.discount > 0) {
    textRight('Discount', totalsLeft + 60, y, 10, regular, muted);
    textRight(`-${formatMoney(totals.discount, cur)}`, right, y, 10, regular, muted);
    y -= 16;
  }

  if (opts.taxRate > 0) {
    textRight(`${opts.taxLabel} ${opts.taxRate}%`, totalsLeft + 60, y, 10, regular, muted);
    textRight(formatMoney(totals.tax, cur), right, y, 10, regular, muted);
    y -= 16;
  }

  // The rule sits between the last line and the grand total, never through it.
  const ruleY = y - 2;
  y = ruleY - 18;

  if (state.template === 'contractor') {
    page.drawRectangle({
      x: totalsLeft,
      y: y - 9,
      width: right - totalsLeft,
      height: 31,
      color: heading,
    });
    text('Total', totalsLeft + 12, y, 14, bold, white);
    textRight(formatMoney(totals.total, cur), right - 12, y, 14, bold, white);
  } else {
    page.drawLine({
      start: { x: totalsLeft, y: ruleY },
      end: { x: right, y: ruleY },
      thickness: 2,
      color: state.template === 'bold-header' ? accent : heading,
    });
    text('Total', totalsLeft, y, 14, bold, heading);
    textRight(formatMoney(totals.total, cur), right, y, 14, bold, heading);
  }

  // Footers, drawn once the page count is known
  pages.forEach((sheet, index) => {
    if (index === pages.length - 1) {
      sheet.drawText(winAnsi(state.notes || c.defaultNote), {
        x: MARGIN,
        y: MARGIN,
        size: 9.5,
        font: regular,
        color: muted,
      });
    }
    const label = `Page ${index + 1} of ${pages.length}`;
    sheet.drawText(label, {
      x: right - regular.widthOfTextAtSize(label, 9.5),
      y: MARGIN,
      size: 9.5,
      font: regular,
      color: muted,
    });
  });

  doc.setTitle(`${title} ${state.number || ''}`.trim());
  doc.setProducer('Billwright');
  doc.setCreator('Billwright');

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
