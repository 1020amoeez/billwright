import type { DocState, DocKind, Totals } from './store';
import { parseAmount } from './format';
import { formatAmount, formatMoney, formatQty, formatDate } from './format';

export interface PaperCopy {
  title: string;
  dateLabel: string;
  dueLabel: string;
  defaultNote: string;
}

export const copyFor: Record<DocKind, PaperCopy> = {
  invoice: {
    title: 'Invoice',
    dateLabel: 'Issued',
    dueLabel: 'Due',
    defaultNote: 'Payment due within 14 days. Thank you.',
  },
  quotation: {
    title: 'Quotation',
    dateLabel: 'Issued',
    dueLabel: 'Valid until',
    defaultNote: 'This quotation is valid for 30 days.',
  },
  receipt: {
    title: 'Receipt',
    dateLabel: 'Issued',
    dueLabel: 'Paid on',
    defaultNote: 'Paid in full. Thank you.',
  },
};

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Falls back to the bracketed placeholder the design uses for empty fields. */
function orPlaceholder(value: string, placeholder: string): string {
  const trimmed = (value ?? '').trim();
  return esc(trimmed || placeholder);
}

export interface RenderOptions {
  taxLabel: string;
  taxRate: number;
}

export function renderPaper(state: DocState, totals: Totals, opts: RenderOptions): string {
  const c = copyFor[state.kind];
  const isLedger = state.template === 'ledger';
  const title = isLedger && state.kind === 'invoice' ? 'Tax invoice' : c.title;
  const cur = state.currency;

  const rows = state.items
    .filter((item) => item.description.trim() || parseAmount(item.unitPrice))
    .map((item) => {
      const amount = parseAmount(item.qty) * parseAmount(item.unitPrice);
      return `<div class="pp-row">
        <div>${orPlaceholder(item.description, 'Item description')}</div>
        <div class="pp-r tnum">${formatQty(parseAmount(item.qty))}</div>
        <div class="pp-r tnum">${formatAmount(parseAmount(item.unitPrice), cur)}</div>
        <div class="pp-r tnum">${formatAmount(amount, cur)}</div>
      </div>`;
    })
    .join('');

  const discountRow =
    totals.discount > 0
      ? `<div class="pp-total"><span>Discount</span><span>−${formatMoney(totals.discount, cur)}</span></div>`
      : '';

  const taxRow =
    opts.taxRate > 0
      ? `<div class="pp-total"><span>${esc(opts.taxLabel)} ${opts.taxRate}%</span><span>${formatMoney(totals.tax, cur)}</span></div>`
      : '';

  return `
<div class="pp-head">
  <div class="pp-title">
    <div class="pp-word">${esc(title)}</div>
    <div class="pp-meta">No. ${orPlaceholder(state.number, '0001')} &nbsp; ${c.dateLabel} ${esc(formatDate(state.issueDate))}</div>
  </div>
  <div class="pp-brand">
    <div class="pp-mark"></div>
    <div class="pp-brand-name">${orPlaceholder(state.businessName, 'Your business')}</div>
  </div>
</div>

<div class="pp-parties">
  <div>
    <div class="pp-muted">From</div>
    <div class="pp-strong">${orPlaceholder(state.businessName, '[Your business]')}</div>
    <div class="pp-muted">${orPlaceholder(state.businessAddress, '[Your address]')}</div>
    ${state.businessEmail.trim() ? `<div class="pp-muted">${esc(state.businessEmail)}</div>` : ''}
  </div>
  <div>
    <div class="pp-muted">${state.kind === 'receipt' ? 'Received from' : 'Bill to'}</div>
    <div class="pp-strong">${orPlaceholder(state.clientName, '[Client name]')}</div>
    <div class="pp-muted">${c.dueLabel} ${esc(formatDate(state.dueDate))}</div>
  </div>
</div>

<div class="pp-table">
  <div class="pp-row pp-row--head">
    <div>Description</div>
    <div class="pp-r">Qty</div>
    <div class="pp-r">Unit price</div>
    <div class="pp-r">Amount</div>
  </div>
  ${rows || '<div class="pp-row pp-row--empty"><div>Add an item to see it here</div><div></div><div></div><div></div></div>'}
</div>

<div class="pp-totals tnum">
  <div class="pp-total"><span>Subtotal</span><span>${formatMoney(totals.subtotal, cur)}</span></div>
  ${discountRow}
  ${taxRow}
  <div class="pp-total pp-total--grand"><span>Total</span><span>${formatMoney(totals.total, cur)}</span></div>
</div>

<div class="pp-foot">
  <span>${orPlaceholder(state.notes, c.defaultNote)}</span>
  <span data-page-label>Page 1 of 1</span>
</div>`;
}
