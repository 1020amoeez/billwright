import { formatNumber, formatPercent } from '../format';

export interface CalcResult {
  primary: string;
  stats: string[];
}

export type CalcFn = (v: Record<string, number>, raw: Record<string, string>) => CalcResult;

const DASH = '—';

/** Every calculator on the site. The key matches `data-calc` on the card. */
export const registry: Record<string, CalcFn> = {
  'profit-margin': ({ cost, price, units }) => {
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : NaN;
    const markup = cost > 0 ? (profit / cost) * 100 : NaN;
    return {
      primary: Number.isFinite(margin) ? formatPercent(margin) : DASH,
      stats: [
        Number.isFinite(markup) ? formatPercent(markup, 0) : DASH,
        formatNumber(profit),
        units > 0 ? formatNumber(price * units) : DASH,
        units > 0 ? formatNumber(profit * units) : DASH,
      ],
    };
  },

  markup: ({ cost, markup, units }) => {
    const price = cost * (1 + markup / 100);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : NaN;
    return {
      primary: cost > 0 ? formatNumber(price) : DASH,
      stats: [
        Number.isFinite(margin) ? formatPercent(margin) : DASH,
        cost > 0 ? formatNumber(profit) : DASH,
        units > 0 ? formatNumber(price * units) : DASH,
        units > 0 ? formatNumber(profit * units) : DASH,
      ],
    };
  },

  'break-even': ({ fixed, price, variable, expected }) => {
    const contribution = price - variable;
    const units = contribution > 0 ? fixed / contribution : NaN;
    const marginPct = price > 0 ? (contribution / price) * 100 : NaN;
    const profit = expected > 0 ? expected * contribution - fixed : NaN;
    return {
      primary: Number.isFinite(units) ? formatNumber(Math.ceil(units), 0) : DASH,
      stats: [
        Number.isFinite(units) ? formatNumber(Math.ceil(units) * price) : DASH,
        contribution > 0 ? formatNumber(contribution) : DASH,
        Number.isFinite(marginPct) ? formatPercent(marginPct) : DASH,
        Number.isFinite(profit) ? formatNumber(profit) : DASH,
      ],
    };
  },

  'freelance-rate': ({ income, costs, hours, weeks }) => {
    const needed = income + costs;
    const billable = hours * weeks;
    const rate = billable > 0 ? needed / billable : NaN;
    return {
      primary: Number.isFinite(rate) ? formatNumber(rate) : DASH,
      stats: [
        Number.isFinite(rate) ? formatNumber(rate * 8) : DASH,
        needed > 0 ? formatNumber(needed / 12) : DASH,
        billable > 0 ? formatNumber(billable, 0) : DASH,
        Number.isFinite(rate) ? formatNumber(rate * hours) : DASH,
      ],
    };
  },

  vat: (v, raw) => {
    // The country select carries the rate as its value; "other" hands over to the box.
    const rate = raw.country === 'other' ? v.customRate : v.country;
    const removing = raw.direction === 'gross';
    const net = removing ? v.amount / (1 + rate / 100) : v.amount;
    const vat = net * (rate / 100);
    const gross = net + vat;
    const has = v.amount > 0;
    return {
      primary: has ? formatNumber(vat) : DASH,
      stats: [
        has ? formatNumber(net) : DASH,
        has ? formatNumber(gross) : DASH,
        formatPercent(rate, rate % 1 === 0 ? 0 : 2),
        has && gross > 0 ? formatPercent((vat / gross) * 100) : DASH,
      ],
    };
  },
};
