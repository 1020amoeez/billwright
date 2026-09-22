import { parseAmount } from './format';

export type DocKind = 'invoice' | 'quotation' | 'receipt';

export interface LineItem {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
}

export interface DocState {
  kind: DocKind;
  template: string;
  currency: string;
  number: string;
  issueDate: string;
  dueDate: string;
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  clientName: string;
  /** Country code whose tax applies, or 'none'. */
  tax: string;
  /** Rate the user typed, used when the country has no standard rate. */
  taxRate: string;
  discount: string;
  notes: string;
  items: LineItem[];
}

export interface Totals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

const KEY_PREFIX = 'billwright:';

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyItem(): LineItem {
  return { id: newId(), description: '', qty: '1', unitPrice: '' };
}

export function computeTotals(state: DocState, rate: number): Totals {
  const subtotal = state.items.reduce(
    (sum, item) => sum + parseAmount(item.qty) * parseAmount(item.unitPrice),
    0,
  );
  const discount = Math.min(parseAmount(state.discount), subtotal);
  const taxable = subtotal - discount;
  const tax = taxable * (rate / 100);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export function load(kind: DocKind, fallback: DocState): DocState {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + kind);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DocState>;
    const merged: DocState = { ...fallback, ...parsed, kind };
    if (!Array.isArray(merged.items) || merged.items.length === 0) {
      merged.items = fallback.items;
    }
    merged.items = merged.items.map((item) => ({ ...emptyItem(), ...item }));
    return merged;
  } catch {
    return fallback;
  }
}

export function save(state: DocState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY_PREFIX + state.kind, JSON.stringify(state));
  } catch {
    /* Private mode, or the quota is full. The app still works, it just forgets. */
  }
}

export function clear(kind: DocKind): void {
  try {
    localStorage.removeItem(KEY_PREFIX + kind);
  } catch {
    /* no-op */
  }
}
