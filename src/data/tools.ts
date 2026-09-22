import type { IconName } from '~/components/ui/icons';

export interface Tool {
  /** Route path, with leading slash. */
  href: string;
  /** Full name, used as the card title and the page h1. */
  name: string;
  /** Compact label for sidebars and breadcrumbs. */
  short: string;
  /** One-line description, from Main.dc.html. */
  blurb: string;
  icon: IconName;
  kind: 'document' | 'calculator';
  /** Shown in the 6-up grid on the homepage. */
  onHomepage: boolean;
}

export const tools: Tool[] = [
  {
    href: '/invoice-generator',
    name: 'Invoice generator',
    short: 'Invoice generator',
    blurb: 'Line items, tax, discounts, your logo. Exports a clean PDF.',
    icon: 'invoice',
    kind: 'document',
    onHomepage: true,
  },
  {
    href: '/quotation-maker',
    name: 'Quotation maker',
    short: 'Quotation maker',
    blurb: 'Send an estimate first, convert it to an invoice when the job is won.',
    icon: 'quote',
    kind: 'document',
    onHomepage: true,
  },
  {
    href: '/receipt-generator',
    name: 'Receipt generator',
    short: 'Receipt generator',
    blurb: 'Proof of payment for cash or bank transfer, in seconds.',
    icon: 'receipt',
    kind: 'document',
    onHomepage: true,
  },
  {
    href: '/profit-margin-calculator',
    name: 'Profit margin calculator',
    short: 'Profit margin',
    blurb: 'Cost and price in, margin and markup out.',
    icon: 'margin',
    kind: 'calculator',
    onHomepage: true,
  },
  {
    href: '/break-even-calculator',
    name: 'Break-even calculator',
    short: 'Break-even',
    blurb: 'How many units, hours or clients before you stop losing money.',
    icon: 'chart',
    kind: 'calculator',
    onHomepage: true,
  },
  {
    href: '/freelance-rate-calculator',
    name: 'Freelance rate calculator',
    short: 'Freelance rate',
    blurb: 'Work backwards from the income you want to the hourly rate you need.',
    icon: 'clock',
    kind: 'calculator',
    onHomepage: true,
  },
  {
    href: '/vat-calculator',
    name: 'VAT calculator',
    short: 'VAT',
    blurb: 'Add VAT to a net price or strip it out of a gross one.',
    icon: 'tag',
    kind: 'calculator',
    onHomepage: false,
  },
  {
    href: '/markup-calculator',
    name: 'Markup calculator',
    short: 'Markup',
    blurb: 'Set a price from your cost and the markup you want to add.',
    icon: 'bars',
    kind: 'calculator',
    onHomepage: false,
  },
];

export const homepageTools = tools.filter((t) => t.onHomepage);
export const calculators = tools.filter((t) => t.kind === 'calculator');

export function toolByHref(href: string): Tool {
  const tool = tools.find((t) => t.href === href);
  if (!tool) throw new Error(`Unknown tool: ${href}`);
  return tool;
}

/** Related tools for a sidebar: the named ones, else every other calculator. */
export function relatedTools(currentHref: string, order?: string[]): Tool[] {
  if (order) return order.map(toolByHref);
  return [
    ...calculators.filter((t) => t.href !== currentHref),
    toolByHref('/invoice-generator'),
  ].slice(0, 5);
}
