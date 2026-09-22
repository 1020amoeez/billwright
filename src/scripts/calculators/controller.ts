import { parseAmount } from '../format';
import { registry } from './registry';

const STORAGE_PREFIX = 'billwright:calc:';

/** Wires every calculator card on the page. Values persist per calculator. */
export function initCalculators(): void {
  document.querySelectorAll<HTMLElement>('.calc[data-calc]').forEach(setup);
}

function setup(card: HTMLElement): void {
  const key = card.dataset.calc;
  const compute = key ? registry[key] : undefined;
  if (!key || !compute) return;

  const inputs = Array.from(
    card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-input]'),
  );
  const defaults = new Map(inputs.map((el) => [el.dataset.input!, el.value]));

  const readValues = () => {
    const raw: Record<string, string> = {};
    const numbers: Record<string, number> = {};
    for (const el of inputs) {
      const name = el.dataset.input!;
      raw[name] = el.value;
      numbers[name] = parseAmount(el.value);
    }
    return { raw, numbers };
  };

  const render = () => {
    const { raw, numbers } = readValues();
    const result = compute(numbers, raw);

    const primary = card.querySelector<HTMLElement>('[data-out="primary"]');
    if (primary) primary.textContent = result.primary;

    result.stats.forEach((value, i) => {
      const el = card.querySelector<HTMLElement>(`[data-out="stat${i}"]`);
      if (el) el.textContent = value;
    });

    persist(raw);
  };

  function persist(raw: Record<string, string>): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(raw));
    } catch {
      /* Private mode or full quota — the calculator still works. */
    }
  }

  function restore(): void {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + key);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Record<string, string>;
      for (const el of inputs) {
        const value = parsed[el.dataset.input!];
        if (typeof value === 'string') el.value = value;
      }
    } catch {
      /* Ignore anything we cannot read back. */
    }
  }

  card.addEventListener('input', render);
  card.addEventListener('change', render);

  card.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'calc-reset') {
      for (const el of inputs) el.value = defaults.get(el.dataset.input!) ?? '';
      render();
      inputs[0]?.focus();
    }

    if (button.dataset.action === 'calc-copy') {
      const lines: string[] = [];
      const primaryLabel = card.querySelector('.calc__primary-label')?.textContent?.trim();
      const primaryValue = card.querySelector('[data-out="primary"]')?.textContent?.trim();
      if (primaryLabel && primaryValue) lines.push(`${primaryLabel}: ${primaryValue}`);
      card.querySelectorAll<HTMLElement>('.calc__stat').forEach((stat) => {
        const label = stat.querySelector('.calc__stat-label')?.textContent?.trim();
        const value = stat.querySelector('.calc__stat-value')?.textContent?.trim();
        if (label && value) lines.push(`${label}: ${value}`);
      });

      const text = lines.join('\n');
      const done = () => {
        const original = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => {
          button.textContent = original;
        }, 1600);
      };

      navigator.clipboard?.writeText(text).then(done).catch(() => {
        // Clipboard permission denied, or an insecure origin.
        button.textContent = 'Press Ctrl+C to copy';
      });
    }
  });

  restore();
  render();
}
