import type { Country } from './types';
import { pk } from './pk';
import { ae } from './ae';
import { gb } from './gb';
import { india } from './in';
import { sa } from './sa';
import { au } from './au';
import { ca } from './ca';
import { us } from './us';

/** Order matches the country strip on the homepage. */
export const countries: Country[] = [pk, ae, gb, india, sa, au, ca, us];

export const defaultCountry = pk;

export function getCountry(code: string | null | undefined): Country {
  return countries.find((c) => c.code === code) ?? defaultCountry;
}

/** Currency codes offered in the generator's top bar, in design order. */
export const currencyCodes = ['PKR', 'USD', 'AED', 'GBP', 'INR', 'SAR', 'AUD', 'CAD'];

/** Option labels for the generator's tax select, e.g. "Sales tax 17% (Pakistan)". */
export function taxOptions() {
  return countries
    .filter((c) => c.taxRate !== null)
    .map((c) => ({
      value: c.code,
      label: `${c.taxLabel} ${c.taxRate}% (${c.shortName})`,
      rate: c.taxRate as number,
      taxLabel: c.taxLabel,
    }));
}

export type { Country };
