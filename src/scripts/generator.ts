import { computeTotals, emptyItem, load, save, clear, type DocKind, type DocState } from './store';
import { defaultState } from './defaults';
import { renderPaper } from './paper';
import { renderItems } from './itemsView';
import { buildPdf, downloadPdf } from './pdf';
import { countries, getCountry } from '~/data/countries';
import { templates } from '~/data/templates';
import { parseAmount, formatAmount, formatQty } from './format';

/** Resolves the tax label and rate for whatever the tax select is on. */
function taxFor(state: DocState): { label: string; rate: number } {
  if (state.tax === 'none') return { label: '', rate: 0 };
  if (state.tax === 'custom') return { label: 'Tax', rate: parseAmount(state.taxRate) };
  const country = countries.find((c) => c.code === state.tax);
  if (!country) return { label: '', rate: 0 };
  if (country.taxRate === null) {
    return { label: country.taxLabel, rate: parseAmount(state.taxRate) };
  }
  return { label: country.taxLabel, rate: country.taxRate };
}

export function initGenerator(): void {
  const app = document.querySelector<HTMLElement>('.app');
  const form = document.querySelector<HTMLFormElement>('#pane-form');
  const paper = document.querySelector<HTMLElement>('#paper');
  const itemsList = document.querySelector<HTMLElement>('#items-list');
  const status = document.querySelector<HTMLElement>('#status');
  if (!app || !form || !paper || !itemsList) return;

  const kind = (app.dataset.kind ?? 'invoice') as DocKind;
  let state = load(kind, defaultState(kind));

  // "Use template" links from the gallery arrive as ?template=ledger
  const requested = new URLSearchParams(window.location.search).get('template');
  if (requested && templates.some((t) => t.id === requested)) {
    state.template = requested;
  }

  const templateSelect = document.querySelector<HTMLSelectElement>('#template-select');
  const currencySelect = document.querySelector<HTMLSelectElement>('#currency-select');
  const customRateField = document.querySelector<HTMLElement>('#custom-rate-field');
  const downloadBtn = document.querySelector<HTMLButtonElement>('#download-pdf');

  let sayTimer: number | undefined;
  function say(message: string): void {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => {
      status.textContent = '';
    }, 4000);
  }

  function syncControls(): void {
    if (templateSelect) templateSelect.value = state.template;
    if (currencySelect) currencySelect.value = state.currency;

    form!.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      '[data-field]',
    ).forEach((el) => {
      const field = el.dataset.field as keyof DocState;
      if (!field || field === 'items') return;
      const value = state[field];
      if (typeof value === 'string' && el.value !== value) el.value = value;
    });

    // The rate box only matters where there is no single national rate.
    const needsRate =
      state.tax === 'custom' ||
      (state.tax !== 'none' && getCountry(state.tax).taxRate === null && state.tax !== '');
    if (customRateField) customRateField.hidden = !needsRate;
  }

  function renderPreview(): void {
    const tax = taxFor(state);
    const totals = computeTotals(state, tax.rate);
    paper!.className = `paper paper--${state.template}`;
    paper!.innerHTML = renderPaper(state, totals, { taxLabel: tax.label, taxRate: tax.rate });
    scheduleMeasure();
  }

  function renderItemList(): void {
    itemsList!.innerHTML = renderItems(state.items);
  }

  let saveTimer: number | undefined;
  function persist(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => save(state), 250);
  }

  function update(mutate: (draft: DocState) => void, opts: { items?: boolean } = {}): void {
    mutate(state);
    if (opts.items) renderItemList();
    renderPreview();
    persist();
  }

  const A4_PX = 876;

  function measure(): void {
    updatePageCount();
    fitPaper();
  }

  // Measuring forces layout, so it waits for a frame rather than the keystroke.
  let measureQueued = false;
  function scheduleMeasure(): void {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => {
      measureQueued = false;
      measure();
    });
  }

  /** The sheet is a fixed 620px wide, so it is scaled to whatever room the pane has. */
  function fitPaper(): void {
    const stage = document.querySelector<HTMLElement>('#paper-stage');
    const scaler = document.querySelector<HTMLElement>('#paper-scaler');
    if (!stage || !scaler || !paper) return;
    const scale = Math.min(1, stage.clientWidth / 620);
    scaler.style.transform = scale < 1 ? `scale(${scale})` : '';
    scaler.style.height = `${paper.offsetHeight * scale}px`;
  }

  /** Keeps the preview's page count honest once the sheet has been laid out. */
  function updatePageCount(): void {
    // A hidden pane measures as zero, which would report the wrong count.
    if (!paper || paper.offsetHeight === 0) return;
    const pages = Math.max(1, Math.ceil(paper.offsetHeight / A4_PX));
    const label = `Page 1 of ${pages}`;
    const inSheet = paper.querySelector<HTMLElement>('[data-page-label]');
    if (inSheet) inSheet.textContent = label;
    const bar = document.querySelector<HTMLElement>('#page-count');
    if (bar) bar.textContent = pages === 1 ? 'A4, 1 page' : `A4, ${pages} pages`;
  }

  // --- Field edits -------------------------------------------------------
  form.addEventListener('input', (event) => {
    const el = event.target as HTMLElement;

    const row = el.closest<HTMLElement>('.item-row');
    if (row && el instanceof HTMLInputElement) {
      const id = row.dataset.itemId;
      const field = el.dataset.field as 'description' | 'qty' | 'unitPrice' | undefined;
      if (id && field) {
        update((draft) => {
          const item = draft.items.find((i) => i.id === id);
          if (item) item[field] = el.value;
        });
      }
      return;
    }

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      const field = el.dataset.field as keyof DocState | undefined;
      if (!field || field === 'items') return;
      update((draft) => {
        (draft as unknown as Record<string, string>)[field] = el.value;
      });
      if (field === 'tax') syncControls();
    }
  });

  // Tidy typed numbers when a field loses focus, so the form reads like the preview.
  form.addEventListener('focusout', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || !el.value.trim()) return;
    const field = el.dataset.field;
    const inRow = Boolean(el.closest('.item-row'));

    if (inRow && field === 'unitPrice') {
      el.value = formatAmount(parseAmount(el.value), state.currency);
    } else if (inRow && field === 'qty') {
      el.value = formatQty(parseAmount(el.value));
    } else if (field === 'discount') {
      el.value = formatAmount(parseAmount(el.value), state.currency);
    } else {
      return;
    }

    update((draft) => {
      if (inRow) {
        const id = el.closest<HTMLElement>('.item-row')?.dataset.itemId;
        const item = draft.items.find((i) => i.id === id);
        if (item && (field === 'qty' || field === 'unitPrice')) item[field] = el.value;
      } else {
        draft.discount = el.value;
      }
    });
  });

  form.addEventListener('change', (event) => {
    const el = event.target as HTMLElement;
    if (el instanceof HTMLSelectElement && el.dataset.field === 'tax') {
      update((draft) => {
        draft.tax = el.value;
      });
      syncControls();
    }
  });

  // --- Item add and remove ----------------------------------------------
  form.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'add-item') {
      update((draft) => draft.items.push(emptyItem()), { items: true });
      const inputs = itemsList.querySelectorAll<HTMLInputElement>('.item-row input');
      inputs[inputs.length - 3]?.focus();
      say('Item added.');
    }

    if (action === 'remove-item') {
      const row = button.closest<HTMLElement>('.item-row');
      const id = row?.dataset.itemId;
      if (!id) return;
      update((draft) => {
        draft.items = draft.items.filter((i) => i.id !== id);
        if (draft.items.length === 0) draft.items.push(emptyItem());
      }, { items: true });
      say('Item removed.');
    }

    if (action === 'draft') {
      void draftItems(button);
      return;
    }

    if (action === 'reset') {
      clear(kind);
      state = defaultState(kind);
      renderItemList();
      syncControls();
      renderPreview();
      measure(); // a one-off action, so the labels update without waiting for a frame
      persist();
      say('Started a new document.');
    }
  });

  // --- Draft line items from a description -------------------------------
  /**
   * The only call that leaves the browser, and only on this click. It posts the
   * typed sentence and nothing else; the returned rows are appended as ordinary
   * items, so everything after this point is local again.
   */
  async function draftItems(button: HTMLButtonElement): Promise<void> {
    const box = document.querySelector<HTMLTextAreaElement>('#draft-text');
    const text = box?.value.trim() ?? '';

    if (text.length < 3) {
      say('Describe the work in a sentence or two first.');
      box?.focus();
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Drafting…';

    try {
      const response = await fetch('/api/draft-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const payload = (await response.json()) as {
        items?: { description: string; qty: number; unitPrice: number }[];
        error?: string;
      };

      if (!response.ok || !payload.items?.length) {
        say(payload.error ?? 'Could not draft those items. Add them by hand.');
        return;
      }

      const drafted = payload.items.map((item) => ({
        ...emptyItem(),
        description: item.description,
        qty: String(item.qty),
        unitPrice: item.unitPrice > 0 ? formatAmount(item.unitPrice, state.currency) : '',
      }));

      update((draft) => {
        // Replace the seed rows on first use; add to real work afterwards.
        const untouched = draft.items.every(
          (item) => !item.description.trim() && !parseAmount(item.unitPrice),
        );
        draft.items = untouched ? drafted : [...draft.items, ...drafted];
      }, { items: true });

      measure();
      if (box) box.value = '';
      say(`Added ${drafted.length} line item${drafted.length === 1 ? '' : 's'}. Check the numbers.`);
    } catch {
      say('Could not reach the drafting service. Add the items by hand.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  // --- Top bar -----------------------------------------------------------
  templateSelect?.addEventListener('change', () => {
    update((draft) => {
      draft.template = templateSelect.value;
    });
  });

  currencySelect?.addEventListener('change', () => {
    update((draft) => {
      draft.currency = currencySelect.value;
    });
  });

  // --- PDF ---------------------------------------------------------------
  downloadBtn?.addEventListener('click', async () => {
    const original = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Building PDF…';
    try {
      const tax = taxFor(state);
      const totals = computeTotals(state, tax.rate);
      const bytes = await buildPdf(state, totals, { taxLabel: tax.label, taxRate: tax.rate });
      const name = `${kind}-${state.number || 'draft'}.pdf`;
      downloadPdf(bytes, name);
      say('PDF downloaded.');
    } catch (error) {
      console.error(error);
      say('The PDF could not be built. Check the amounts and try again.');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = original;
    }
  });

  // --- Mobile tabs -------------------------------------------------------
  const split = document.querySelector<HTMLElement>('#split');
  const tabForm = document.querySelector<HTMLButtonElement>('#tab-form');
  const tabPreview = document.querySelector<HTMLButtonElement>('#tab-preview');

  function showPane(pane: 'form' | 'preview'): void {
    if (!split) return;
    split.dataset.pane = pane;
    tabForm?.classList.toggle('is-active', pane === 'form');
    tabPreview?.classList.toggle('is-active', pane === 'preview');
    tabForm?.setAttribute('aria-selected', String(pane === 'form'));
    tabPreview?.setAttribute('aria-selected', String(pane === 'preview'));
    if (pane === 'preview') scheduleMeasure();
  }

  tabForm?.addEventListener('click', () => showPane('form'));
  tabPreview?.addEventListener('click', () => showPane('preview'));

  // Fires on window resize and when the preview pane is revealed on mobile,
  // which is more dependable than waiting for a frame in a background tab.
  const stageEl = document.querySelector<HTMLElement>('#paper-stage');
  if (stageEl && 'ResizeObserver' in window) {
    new ResizeObserver(() => measure()).observe(stageEl);
  } else {
    window.addEventListener('resize', measure);
  }

  // A debounced save could still be pending when the tab closes.
  window.addEventListener('pagehide', () => {
    window.clearTimeout(saveTimer);
    save(state);
  });

  // Re-measure when a tab opened in the background is finally looked at:
  // frame callbacks do not run while the document is hidden.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) measure();
  });

  // First paint: the server rendered defaults, so re-render from stored state.
  syncControls();
  renderItemList();
  renderPreview();
  measure(); // synchronously, so the first frame is already correct
}
