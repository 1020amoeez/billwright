export type TemplateFormat = 'PDF' | 'Word' | 'Excel';

export interface Template {
  id: string;
  name: string;
  blurb: string;
  professions: string[];
  countries: string[];
  formats: TemplateFormat[];
}

export const professions = ['All', 'Freelancer', 'Contractor', 'Photographer', 'Consultant'];
export const templateCountries = ['Any', 'Pakistan', 'UAE', 'UK', 'India'];
export const formats: TemplateFormat[] = ['PDF', 'Word', 'Excel'];

/** Order matches the gallery grid in Templates.dc.html. */
export const templates: Template[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Works for almost everyone',
    professions: ['Freelancer', 'Contractor', 'Photographer', 'Consultant'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Word', 'Excel'],
  },
  {
    id: 'bold-header',
    name: 'Bold header',
    blurb: 'Agencies, studios, designers',
    professions: ['Freelancer', 'Photographer', 'Consultant'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Word'],
  },
  {
    id: 'compact',
    name: 'Compact',
    blurb: 'Many line items, one page',
    professions: ['Contractor', 'Consultant'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Excel'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Consultants, writers, coaches',
    professions: ['Freelancer', 'Consultant'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Word'],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    blurb: 'Tax-registered businesses, GST and VAT fields',
    professions: ['Contractor', 'Consultant'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Excel'],
  },
  {
    id: 'contractor',
    name: 'Contractor',
    blurb: 'Trades, repairs, on-site work',
    professions: ['Contractor'],
    countries: ['Pakistan', 'UAE', 'UK', 'India'],
    formats: ['PDF', 'Word'],
  },
];

/** The three the generator's top bar offers, per Generator.dc.html. */
export const generatorTemplates = templates;
