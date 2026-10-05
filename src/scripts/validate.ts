import type { DocState } from './store';
import { parseAmount } from './format';

/**
 * What a document needs before it can be downloaded. Each error names the
 * field it belongs to (and the row, for line items) so the form can put the
 * message under the right input.
 */
export interface FieldError {
  field: string;
  /** Set for line-item errors. */
  itemId?: string;
  message: string;
}

/** Fields that must be filled in, used for the red asterisks too. */
export const requiredFields = [
  'businessName',
  'businessAddress',
  'clientName',
  'number',
  'issueDate',
  'dueDate',
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Digits and one decimal point, once grouping is removed. Grouping is not
 * checked: amounts are reformatted per currency, and en-IN writes 1,00,000.
 */
function isNumber(value: string): boolean {
  return /^(\d+(\.\d+)?|\.\d+)$/.test(value.replace(/[,\s]/g, ''));
}

export interface ValidateContext {
  noun: string;
  /** The tax select is on a country without a standard rate, or "Other rate". */
  needsRate: boolean;
}

export function validate(state: DocState, ctx: ValidateContext): FieldError[] {
  const errors: FieldError[] = [];
  const need = (field: string, message: string) => {
    const value = (state as unknown as Record<string, unknown>)[field];
    if (typeof value !== 'string' || !value.trim()) errors.push({ field, message });
  };

  need('businessName', 'Add your business name.');
  need('businessAddress', 'Add your business address.');
  const email = state.businessEmail.trim();
  if (email && !EMAIL.test(email)) {
    errors.push({ field: 'businessEmail', message: 'That email does not look right, e.g. name@example.com.' });
  }

  need('clientName', "Add the client's name.");
  need('number', `Add ${/^[aeiou]/i.test(ctx.noun) ? 'an' : 'a'} ${ctx.noun} number.`);
  need('issueDate', 'Add the issue date.');
  need('dueDate', state.kind === 'receipt' ? 'Add the date it was paid.' : 'Add the due date.');

  // A receipt's "Paid on" can be before it was issued; a due date cannot.
  if (state.kind !== 'receipt' && state.issueDate && state.dueDate && state.dueDate < state.issueDate) {
    errors.push({
      field: 'dueDate',
      message:
        state.kind === 'quotation'
          ? 'Valid until cannot be before the issue date.'
          : 'The due date cannot be before the issue date.',
    });
  }

  // Line items: at least one described line, and every number a real number.
  const described = state.items.filter((item) => item.description.trim());
  if (described.length === 0 && state.items[0]) {
    errors.push({ field: 'description', itemId: state.items[0].id, message: 'Add at least one item.' });
  }

  let subtotal = 0;
  for (const item of state.items) {
    const qty = item.qty.trim();
    const price = item.unitPrice.trim();
    const hasContent = Boolean(item.description.trim() || price);

    if (!item.description.trim() && price) {
      errors.push({ field: 'description', itemId: item.id, message: 'Add the item name.' });
    }
    if (hasContent) {
      if (!qty) {
        errors.push({ field: 'qty', itemId: item.id, message: 'Add a quantity.' });
      } else if (!isNumber(qty) || parseAmount(qty) <= 0) {
        errors.push({ field: 'qty', itemId: item.id, message: 'Quantity must be a number above 0.' });
      }
    }
    if (price && !isNumber(price)) {
      errors.push({
        field: 'unitPrice',
        itemId: item.id,
        message: price.startsWith('-') ? 'A price cannot be negative.' : 'Enter a price as a number, e.g. 1,500.',
      });
    }
    subtotal += parseAmount(qty) * parseAmount(price);
  }

  const discount = state.discount.trim();
  if (discount) {
    if (!isNumber(discount)) {
      errors.push({ field: 'discount', message: 'Enter the discount as an amount, e.g. 500.' });
    } else if (parseAmount(discount) > subtotal) {
      errors.push({ field: 'discount', message: 'The discount is more than the subtotal.' });
    }
  }

  if (ctx.needsRate) {
    const rate = state.taxRate.trim();
    if (!rate) {
      errors.push({ field: 'taxRate', message: 'Add the tax rate, or choose None.' });
    } else if (!isNumber(rate) || parseAmount(rate) > 100) {
      errors.push({ field: 'taxRate', message: 'Enter a rate from 0 to 100.' });
    }
  }

  return errors;
}
