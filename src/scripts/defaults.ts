import type { DocKind, DocState } from './store';
import { addDaysIso, todayIso } from './format';
import { copyFor } from './paper';

/**
 * The generator opens on the worked example from the design rather than an
 * empty form, so the preview shows what the tool produces straight away.
 */
export function defaultState(kind: DocKind): DocState {
  return {
    kind,
    template: 'classic',
    currency: 'PKR',
    number: '0042',
    issueDate: todayIso(),
    dueDate: addDaysIso(kind === 'quotation' ? 30 : 14),
    businessName: 'Meridian Studio',
    businessEmail: '',
    businessAddress: '',
    clientName: 'Northwind Traders',
    tax: 'pk',
    taxRate: '',
    discount: '',
    notes: copyFor[kind].defaultNote,
    items: [
      { id: 'seed1', description: 'Brand identity design', qty: '1', unitPrice: '1,800.00' },
      { id: 'seed2', description: 'Landing page build', qty: '1', unitPrice: '2,400.00' },
      { id: 'seed3', description: 'Hosting setup', qty: '2', unitPrice: '150.00' },
    ],
  };
}
