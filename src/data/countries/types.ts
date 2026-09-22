export interface Country {
  /** ISO 3166-1 alpha-2, lowercase. Used as the storage key. */
  code: string;
  /** Full name, as shown on the homepage country strip. */
  name: string;
  /** Short name for compact UI, e.g. the tax select. */
  shortName: string;
  /** ISO 4217 currency code, printed on the invoice. */
  currency: string;
  /** Symbol for calculators. Invoices print the code, per the design. */
  symbol: string;
  /** What this country calls its consumption tax. */
  taxLabel: string;
  /**
   * Standard rate as a percentage. `null` where there is no single national
   * rate (the US), which makes the field user-entered instead.
   */
  taxRate: number | null;
  /** BCP 47 tag driving Intl number and date formatting. */
  locale: string;
  /** Name of the tax registration number shown on tax invoices. */
  taxIdLabel: string;
}
