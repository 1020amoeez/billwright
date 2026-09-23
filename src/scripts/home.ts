import { parseAmount, formatAmount, formatMoney } from './format';
import { computeTotals, type DocState } from './store';
import { getCountry } from '~/data/countries';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ reveal */

function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], [data-step]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // one-shot: nothing re-runs on scroll back
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );

  targets.forEach((el) => observer.observe(el));
}

/* -------------------------------------------------------------- hero video */

function initHeroLoop(): void {
  const hero = document.querySelector<HTMLElement>('[data-hero-invoice]');
  if (!hero || reduceMotion) return;

  let timer: number | undefined;

  const play = () => {
    hero.classList.add('is-replaying', 'is-typing');
    window.setTimeout(() => hero.classList.remove('is-typing'), 780);
    window.setTimeout(() => hero.classList.remove('is-replaying'), 1800);
  };

  // Only loops while it is on screen, so a parked tab does no work.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        play();
        timer = window.setInterval(play, 7000);
      } else {
        window.clearInterval(timer);
      }
    },
    { threshold: 0.25 },
  );

  observer.observe(hero);
}

/* --------------------------------------------------------------- live demo */

function flash(el: Element | null): void {
  if (!el || reduceMotion) return;
  el.classList.remove('is-flash');
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add('is-flash');
}

function initDemo(): void {
  const root = document.querySelector<HTMLElement>('[data-demo]');
  if (!root) return;

  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-demo-row]'));
  const previewRows = Array.from(root.querySelectorAll<HTMLElement>('[data-demo-prow]'));
  const addButton = root.querySelector<HTMLButtonElement>('[data-demo-add]');
  const taxRow = root.querySelector<HTMLElement>('[data-demo-taxrow]');

  const input = (name: string) =>
    root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-demo-input="${name}"]`);

  const out = (name: string) => root.querySelector<HTMLElement>(`[data-demo-out="${name}"]`);

  const previous = new Map<string, string>();

  const write = (el: HTMLElement | null, value: string, key: string) => {
    if (!el) return;
    if (previous.get(key) !== value) {
      if (previous.has(key)) flash(el);
      previous.set(key, value);
    }
    el.textContent = value;
  };

  function render(): void {
    const currency = (input('currency') as HTMLSelectElement | null)?.value ?? 'PKR';
    const taxCode = (input('tax') as HTMLSelectElement | null)?.value ?? 'none';
    const country = taxCode === 'none' ? null : getCountry(taxCode);
    const rate = country?.taxRate ?? 0;

    const items = rows
      .filter((row) => !row.hidden)
      .map((row, index) => ({
        id: String(index),
        description: row.querySelector<HTMLInputElement>('[data-demo-input="desc"]')?.value ?? '',
        qty: row.querySelector<HTMLInputElement>('[data-demo-input="qty"]')?.value ?? '0',
        unitPrice: row.querySelector<HTMLInputElement>('[data-demo-input="price"]')?.value ?? '0',
      }));

    // The same helper the generator totals with — only items and discount are read.
    const totals = computeTotals({ items, discount: '' } as DocState, rate);

    write(out('client'), (input('client') as HTMLInputElement)?.value || 'Client name', 'client');

    previewRows.forEach((previewRow, index) => {
      const item = items[index];
      previewRow.hidden = !item;
      if (!item) return;
      const amount = parseAmount(item.qty) * parseAmount(item.unitPrice);
      write(
        previewRow.querySelector<HTMLElement>('[data-demo-out="desc"]'),
        item.description || 'Item',
        `desc${index}`,
      );
      write(
        previewRow.querySelector<HTMLElement>('[data-demo-out="qty"]'),
        String(parseAmount(item.qty) || 0),
        `qty${index}`,
      );
      write(
        previewRow.querySelector<HTMLElement>('[data-demo-out="amount"]'),
        formatAmount(amount, currency),
        `amount${index}`,
      );
    });

    write(out('subtotal'), formatMoney(totals.subtotal, currency), 'subtotal');
    if (taxRow) taxRow.hidden = rate === 0;
    if (rate > 0 && country) {
      write(out('taxLabel'), `${country.taxLabel} ${rate}%`, 'taxLabel');
      write(out('tax'), formatMoney(totals.tax, currency), 'tax');
    }
    write(out('total'), formatMoney(totals.total, currency), 'total');
  }

  root.addEventListener('input', render);
  root.addEventListener('change', render);

  addButton?.addEventListener('click', () => {
    const next = rows.find((row) => row.hidden);
    if (!next) return;
    next.hidden = false;
    next.querySelector<HTMLInputElement>('[data-demo-input="desc"]')?.focus();
    if (!rows.some((row) => row.hidden)) addButton.hidden = true;
    render();
  });

  render();
}

/* ------------------------------------------------------------ country tabs */

function initCountries(): void {
  const root = document.querySelector<HTMLElement>('[data-countries]');
  if (!root) return;

  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-country]'));
  const subtotal = Number(root.dataset.subtotal ?? '4500');
  const taxRow = root.querySelector<HTMLElement>('[data-out-taxrow]');
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-out="${name}"]`);

  function select(chip: HTMLButtonElement, focus = false): void {
    for (const other of chips) {
      const active = other === chip;
      other.classList.toggle('is-active', active);
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
    }
    if (focus) chip.focus();

    const currency = chip.dataset.currency ?? '';
    const label = chip.dataset.taxLabel ?? '';
    const rateRaw = chip.dataset.rate ?? '';
    const hasRate = rateRaw !== '';
    const rate = hasRate ? Number(rateRaw) : 0;
    const tax = subtotal * (rate / 100);

    if (out('currency')) out('currency')!.textContent = currency;
    if (out('taxLabel')) out('taxLabel')!.textContent = label;
    if (out('rate')) out('rate')!.textContent = hasRate ? `${rate}%` : 'You set it';
    if (out('taxid')) out('taxid')!.textContent = chip.dataset.taxid ?? '';

    if (out('subtotal')) out('subtotal')!.textContent = formatMoney(subtotal, currency);
    if (taxRow) taxRow.hidden = !hasRate;
    if (hasRate) {
      if (out('taxline')) out('taxline')!.textContent = `${label} ${rate}%`;
      if (out('taxamount')) out('taxamount')!.textContent = formatMoney(tax, currency);
    }
    if (out('total')) out('total')!.textContent = formatMoney(subtotal + tax, currency);

    const note = out('note');
    if (note) {
      note.textContent = hasRate
        ? 'Rates are the standard national rate. Reduced rates and exemptions are yours to apply.'
        : 'The US sets sales tax by state and often by city, so the generator asks you for the rate.';
    }

    flash(out('total'));
  }

  chips.forEach((chip, index) => {
    chip.addEventListener('click', () => select(chip));
    chip.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      select(chips[(index + step + chips.length) % chips.length]!, true);
    });
  });
}

initReveal();
initHeroLoop();
initDemo();
initCountries();
