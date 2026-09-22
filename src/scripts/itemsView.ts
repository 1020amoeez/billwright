import type { LineItem } from './store';

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One editable line-item row. Rendered on the server and again in the browser. */
export function renderItemRow(item: LineItem, index: number): string {
  const n = index + 1;
  return `<div class="item-row" data-item-id="${item.id}">
  <input type="text" value="${esc(item.description)}" data-field="description"
    aria-label="Item ${n} description" placeholder="What you did">
  <input type="text" inputmode="decimal" value="${esc(item.qty)}" data-field="qty"
    aria-label="Item ${n} quantity" class="item-row__num">
  <input type="text" inputmode="decimal" value="${esc(item.unitPrice)}" data-field="unitPrice"
    aria-label="Item ${n} unit price" class="item-row__num">
  <button type="button" data-action="remove-item" aria-label="Remove item ${n}">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
  </button>
</div>`;
}

export function renderItems(items: LineItem[]): string {
  return items.map(renderItemRow).join('');
}
