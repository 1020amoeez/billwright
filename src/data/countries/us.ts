import type { Country } from './types';

export const us: Country = {
  code: 'us',
  name: 'United States',
  shortName: 'US',
  currency: 'USD',
  symbol: '$',
  taxLabel: 'Sales tax',
  // No national rate — it is set by state and city, so the user enters it.
  taxRate: null,
  locale: 'en-US',
  taxIdLabel: 'EIN',
};
