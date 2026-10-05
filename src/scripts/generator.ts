import {
  computeTotals,
  emptyItem,
  load,
  save,
  clear,
  type DocKind,
  type DocState,
  type LineItem,
} from './store';
import { defaultState } from './defaults';
import { copyFor, renderPaper } from './paper';
import { renderItems } from './itemsView';
import { buildPdf, downloadPdf } from './pdf';
import { countries, getCountry } from '~/data/countries';
import { templates } from '~/data/templates';
import { parseAmount, formatAmount, formatQty } from './format';
import { defaultLook, fontStacks, headingFor, normaliseLook, textOn, type Look } from './look';
import {
  initialsOf,
  loadBrand,
  logoColour,
  logoSizes,
  prepareLogo,
  saveBrand,
  type Brand,
  type LogoSize,
} from './brand';
import { readLookLocally } from './lookWords';
import { validate, type FieldError } from './validate';

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

/** Countries without one national rate (the US), and "Other rate", need the rate typed in. */
function needsRateFor(state: DocState): boolean {
  return (
    state.tax === 'custom' ||
    (state.tax !== 'none' && state.tax !== '' && getCountry(state.tax).taxRate === null)
  );
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
  /** Shared by every document type, and kept by "Start a new invoice". */
  let brand = loadBrand();

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
    if (customRateField) customRateField.hidden = !needsRateFor(state);

    form!.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-look]').forEach((el) => {
      const key = el.dataset.look as keyof Look;
      const value = state.look[key].toLowerCase();
      if (el.value.toLowerCase() !== value) el.value = state.look[key];
    });
  }

  /** The look is applied as custom properties that paper.css reads. */
  function applyLook(): void {
    const { accent, heading, font } = state.look;
    paper!.style.setProperty('--pp-accent', accent);
    paper!.style.setProperty('--pp-heading', heading);
    paper!.style.setProperty('--pp-on-accent', textOn(accent));
    const stack = fontStacks[font];
    if (stack) {
      paper!.style.setProperty('--pp-font-body', stack.body);
      paper!.style.setProperty('--pp-font-display', stack.display);
    } else {
      paper!.style.removeProperty('--pp-font-body');
      paper!.style.removeProperty('--pp-font-display');
    }
  }

  function renderPreview(): void {
    const tax = taxFor(state);
    const totals = computeTotals(state, tax.rate);
    paper!.className = `paper paper--${state.template}`;
    applyLook();
    paper!.innerHTML = renderPaper(state, totals, { taxLabel: tax.label, taxRate: tax.rate, brand });
    renderLogoThumb();
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
    renderErrors();
    persist();
  }

  // --- Validation ----------------------------------------------------------
  /**
   * A field's error shows once it has been left (or after a download attempt
   * shows them all), and then updates as the user types, so a fix clears it
   * straight away but nobody is scolded mid-word.
   */
  const touched = new Set<string>();
  let showAllErrors = false;

  const errorKey = (field: string, itemId?: string) => (itemId ? `${itemId}:${field}` : field);

  function currentErrors(): FieldError[] {
    return validate(state, { noun: copyFor[kind].title.toLowerCase(), needsRate: needsRateFor(state) });
  }

  function inputFor(error: FieldError): HTMLInputElement | null {
    if (error.itemId) {
      return itemsList!.querySelector<HTMLInputElement>(
        `.item-row[data-item-id="${CSS.escape(error.itemId)}"] [data-field="${error.field}"]`,
      );
    }
    return form!.querySelector<HTMLInputElement>(`[data-field="${error.field}"]`);
  }

  function renderErrors(): FieldError[] {
    const errors = currentErrors();
    form!.querySelectorAll('[aria-invalid]').forEach((el) => {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    });
    form!.querySelectorAll('.field-error').forEach((el) => el.remove());

    const shown = new Set<HTMLElement>();
    for (const error of errors) {
      if (!showAllErrors && !touched.has(errorKey(error.field, error.itemId))) continue;
      const input = inputFor(error);
      // One message per input; the first rule it breaks is the one to fix first.
      if (!input || shown.has(input)) continue;
      shown.add(input);

      const id = `err-${errorKey(error.field, error.itemId).replace(/[^a-z0-9-]/gi, '-')}`;
      const message = document.createElement('span');
      message.className = error.itemId ? 'field-error field-error--item' : 'field-error';
      message.id = id;
      message.textContent = error.message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);

      // Row errors go under the whole row; field errors under their input.
      const row = input.closest<HTMLElement>('.item-row');
      if (row) row.after(message);
      else input.after(message);
    }
    return errors;
  }

  form.addEventListener('focusout', (event) => {
    const el = event.target as HTMLElement;
    const field = el.dataset.field;
    if (!field) return;
    const itemId = el.closest<HTMLElement>('.item-row')?.dataset.itemId;
    touched.add(errorKey(field, itemId));
    // After the number tidy-up in the other focusout handler has run.
    queueMicrotask(renderErrors);
  });

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

    // The AI boxes have listeners of their own further down.
    if (el.id === 'draft-text' || el.id === 'style-text') return;

    const brandKey = el.dataset.brand;
    if (brandKey === 'size' && el instanceof HTMLSelectElement) {
      setBrand({ size: el.value as LogoSize });
      return;
    }
    if (brandKey === 'show' && el instanceof HTMLInputElement) {
      setBrand({ show: el.checked });
      return;
    }
    if (brandKey === 'watermark' && el instanceof HTMLInputElement) {
      setBrand({ watermark: el.checked });
      return;
    }

    const lookKey = el.dataset.look as keyof Look | undefined;
    if (lookKey && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) {
      update((draft) => {
        draft.look = normaliseLook({ ...draft.look, [lookKey]: el.value }, draft.look);
      });
      return;
    }

    const row = el.closest<HTMLElement>('.item-row');
    if (row && el instanceof HTMLInputElement) {
      const id = row.dataset.itemId;
      const field = el.dataset.field as 'description' | 'qty' | 'unitPrice' | undefined;
      if (id && field) {
        update((draft) => {
          const item = draft.items.find((i) => i.id === id);
          if (item) item[field] = el.value;
        });
        // Once edited by hand, a drafted row is the user's and a redraft keeps it.
        aiIds.delete(id);
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
      aiIds.delete(id);
      say('Item removed.');
    }

    if (action === 'pick-logo') logoFile?.click();
    if (action === 'remove-logo') {
      setBrand({ logo: null, ratio: 1 });
      setStatus(logoStatus, 'Logo removed. Your initials show instead.');
    }
    if (action === 'match-logo') void matchLogo(true);

    if (action === 'reset-look') {
      update((draft) => {
        draft.look = { ...defaultLook };
      });
      syncControls();
      if (styleBox) styleBox.value = '';
      lastStyled = '';
      setStatus(styleStatus, 'Back to the default look.');
    }

    if (action === 'reset') {
      clear(kind);
      state = defaultState(kind);
      forgetAi();
      touched.clear();
      showAllErrors = false;
      renderItemList();
      syncControls();
      renderPreview();
      renderErrors();
      measure(); // a one-off action, so the labels update without waiting for a frame
      persist();
      say('Started a new document.');
    }
  });

  // --- AI boxes ------------------------------------------------------------
  /**
   * Both boxes act on a pause in typing, not a button. Only the box's own text
   * leaves the browser (the style box adds the current colours and template);
   * everything the answers change is applied and totalled locally.
   */
  const onLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  type AiResult<T> = { ok: true; data: T } | { ok: false; error: string; unavailable: boolean };

  async function callAi<T>(path: string, body: object, signal: AbortSignal): Promise<AiResult<T>> {
    let response: Response;
    try {
      response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      return { ok: false, error: 'Could not reach the AI service. Check your connection.', unavailable: false };
    }

    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

    // No JSON at all means the endpoint is missing: a server that does not run
    // the functions, answering with its own 404 page.
    if (!payload) {
      return {
        ok: false,
        unavailable: true,
        error: onLocalhost
          ? 'AI is not running on this server. Restart it with npm run dev.'
          : 'AI assist is not available right now.',
      };
    }
    if (!response.ok) {
      const unavailable = response.status === 503;
      const error =
        unavailable && onLocalhost
          ? 'AI needs an API key. Add ANTHROPIC_API_KEY to .dev.vars, then try again.'
          : (payload.error ?? 'The AI service failed. Try again.');
      return { ok: false, error, unavailable };
    }
    return { ok: true, data: payload };
  }

  function setStatus(el: HTMLElement | null, message: string, mode: 'idle' | 'busy' | 'error' = 'idle'): void {
    if (!el) return;
    el.textContent = message;
    el.dataset.state = mode;
  }

  // Drafting ------------------------------------------------------------------
  const draftBox = document.querySelector<HTMLTextAreaElement>('#draft-text');
  const draftStatus = document.querySelector<HTMLElement>('#draft-status');
  const seedItems = defaultState(kind).items;

  /** Rows the last draft produced, which the next draft replaces. */
  let aiIds = new Set<string>();
  let lastDrafted = '';
  let draftTimer: number | undefined;
  let draftController: AbortController | undefined;

  /** Empty rows and the untouched demo rows give way to the first draft. */
  function isPlaceholder(item: LineItem): boolean {
    if (!item.description.trim() && !parseAmount(item.unitPrice)) return true;
    const seed = seedItems.find((s) => s.id === item.id);
    return (
      !!seed &&
      seed.description === item.description &&
      seed.qty === item.qty &&
      seed.unitPrice === item.unitPrice
    );
  }

  function replaceDrafted(next: LineItem[]): void {
    update((draft) => {
      const kept = draft.items.filter((i) => !aiIds.has(i.id) && !isPlaceholder(i));
      draft.items = [...kept, ...next];
      if (draft.items.length === 0) draft.items.push(emptyItem());
    }, { items: true });
    aiIds = new Set(next.map((i) => i.id));
    measure();
  }

  async function runDraft(text: string): Promise<void> {
    if (text === lastDrafted) return;
    draftController?.abort();
    const controller = new AbortController();
    draftController = controller;
    setStatus(draftStatus, 'Drafting items…', 'busy');

    try {
      const result = await callAi<{ items: { description: string; qty: number; unitPrice: number }[] }>(
        '/api/draft-items',
        { text },
        controller.signal,
      );
      if (controller !== draftController) return; // a newer draft is on its way
      if (!result.ok) {
        setStatus(draftStatus, result.error, 'error');
        return;
      }

      lastDrafted = text;
      const drafted = result.data.items.map((item) => ({
        ...emptyItem(),
        description: item.description,
        qty: String(item.qty),
        unitPrice: item.unitPrice > 0 ? formatAmount(item.unitPrice, state.currency) : '',
      }));
      replaceDrafted(drafted);

      const unpriced = drafted.filter((i) => !i.unitPrice).length;
      const count = `${drafted.length} item${drafted.length === 1 ? '' : 's'}`;
      setStatus(
        draftStatus,
        unpriced
          ? `Drafted ${count}. Add a price to ${unpriced === 1 ? 'the one' : `the ${unpriced}`} left blank.`
          : `Drafted ${count}. Keep typing to change them, or edit below.`,
      );
    } catch {
      /* Aborted by a newer keystroke. */
    }
  }

  draftBox?.addEventListener('input', () => {
    window.clearTimeout(draftTimer);
    const text = draftBox.value.trim();

    if (!text) {
      draftController?.abort();
      draftController = undefined;
      lastDrafted = '';
      if (aiIds.size) {
        replaceDrafted([]);
        setStatus(draftStatus, 'Removed the drafted items.');
      } else {
        setStatus(draftStatus, '');
      }
      return;
    }

    // Too short to itemise yet; wait for a few words.
    if (text.length < 12 || !/\s/.test(text)) {
      setStatus(draftStatus, '');
      return;
    }
    draftTimer = window.setTimeout(() => void runDraft(text), 1100);
  });

  // Styling -------------------------------------------------------------------
  const styleBox = document.querySelector<HTMLInputElement>('#style-text');
  const styleStatus = document.querySelector<HTMLElement>('#style-status');
  let lastStyled = '';
  let styleTimer: number | undefined;
  let styleController: AbortController | undefined;
  /** Whether the offline reader understood the current text. */
  let localHandled = false;

  function setLook(look: Partial<Look>, template?: string): void {
    update((draft) => {
      draft.look = normaliseLook({ ...draft.look, ...look }, draft.look);
      if (template && templates.some((t) => t.id === template)) draft.template = template;
    });
    syncControls();
  }

  /**
   * The logo settings when the current request began. The box is re-read on
   * every keystroke, so "bigger logo please" must step once from here rather
   * than once per letter; the AI is sent these too, for the same reason.
   */
  let styleBaseline: { size: LogoSize; show: boolean } | null = null;

  /** "Bigger logo" steps the size; the mark is also shown again, since that is what was asked about. */
  function applyLogoRequest(request: 'bigger' | 'smaller' | 'hide' | 'show'): void {
    const base = styleBaseline ?? { size: brand.size, show: brand.show };
    if (request === 'hide' || request === 'show') {
      if (brand.show !== (request === 'show')) setBrand({ show: request === 'show' });
      return;
    }
    const index = logoSizes.indexOf(base.size) + (request === 'bigger' ? 1 : -1);
    const size = logoSizes[Math.max(0, Math.min(logoSizes.length - 1, index))]!;
    if (size !== brand.size || !brand.show) setBrand({ size, show: true });
  }

  function applyWatermarkRequest(on: boolean): void {
    if (on && !brand.logo) {
      setStatus(styleStatus, 'Upload a logo first; the watermark is made from it.');
      return;
    }
    if (brand.watermark !== on) setBrand({ watermark: on });
  }

  async function runStyle(text: string): Promise<void> {
    if (text === lastStyled) return;
    styleController?.abort();
    const controller = new AbortController();
    styleController = controller;
    setStatus(styleStatus, 'Styling…', 'busy');

    try {
      const result = await callAi<{
        look: Look;
        template: string;
        logoSize: LogoSize;
        showLogo: boolean;
        watermark: boolean;
        note: string;
      }>(
        '/api/style',
        // The logo's settings, never the image itself.
        {
          text,
          look: state.look,
          template: state.template,
          logo: {
            ...(styleBaseline ?? { size: brand.size, show: brand.show }),
            uploaded: Boolean(brand.logo),
            watermark: brand.watermark,
          },
        },
        controller.signal,
      );
      if (controller !== styleController) return;

      if (!result.ok) {
        // Simple requests still worked offline; say so rather than report a failure.
        if (localHandled && result.unavailable) {
          setStatus(styleStatus, 'Done. Colour names, fonts and template names work without AI.');
        } else {
          setStatus(styleStatus, result.error, 'error');
        }
        return;
      }

      lastStyled = text;
      setLook(result.data.look, result.data.template);
      const { logoSize, showLogo } = result.data;
      if (
        logoSizes.includes(logoSize) &&
        typeof showLogo === 'boolean' &&
        (logoSize !== brand.size || showLogo !== brand.show)
      ) {
        setBrand({ size: logoSize, show: showLogo });
      }
      if (typeof result.data.watermark === 'boolean' && brand.logo && result.data.watermark !== brand.watermark) {
        setBrand({ watermark: result.data.watermark });
      }
      setStatus(styleStatus, result.data.note || 'Done.');
    } catch {
      /* Aborted by a newer keystroke. */
    }
  }

  styleBox?.addEventListener('input', () => {
    window.clearTimeout(styleTimer);
    const text = styleBox.value.trim();
    if (!text) {
      styleController?.abort();
      styleBaseline = null;
      setStatus(styleStatus, '');
      return;
    }
    styleBaseline ??= { size: brand.size, show: brand.show };

    // "make it blue" applies on the keystroke that completes the word.
    const local = readLookLocally(text);
    localHandled = !local.empty;
    if (localHandled) setLook(local.look, local.template);
    if (local.logo) applyLogoRequest(local.logo);
    if (local.watermark !== undefined) applyWatermarkRequest(local.watermark);

    if (text.length >= 4) styleTimer = window.setTimeout(() => void runStyle(text), 900);
  });

  // Coming back to the box starts a new request: "even bigger" builds on what is there now.
  styleBox?.addEventListener('focus', () => {
    styleBaseline = null;
  });

  styleBox?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    window.clearTimeout(styleTimer);
    const text = styleBox.value.trim();
    if (text.length >= 3) void runStyle(text);
  });

  // --- Logo -----------------------------------------------------------------
  const logoFile = document.querySelector<HTMLInputElement>('#logo-file');
  const logoStatus = document.querySelector<HTMLElement>('#logo-status');
  const logoThumb = document.querySelector<HTMLElement>('#logo-thumb');

  function setBrand(patch: Partial<Brand>): boolean {
    brand = { ...brand, ...patch };
    const saved = saveBrand(brand);
    syncBrandControls();
    renderPreview();
    return saved;
  }

  /** The thumbnail beside the upload button mirrors the mark on the sheet. */
  function renderLogoThumb(): void {
    if (!logoThumb) return;
    if (brand.logo) {
      logoThumb.innerHTML = `<img src="${brand.logo}" alt="">`;
      logoThumb.style.background = '';
      logoThumb.style.color = '';
      return;
    }
    logoThumb.textContent = initialsOf(state.businessName) || '?';
    logoThumb.style.background = state.look.accent;
    logoThumb.style.color = textOn(state.look.accent);
  }

  function syncBrandControls(): void {
    const has = Boolean(brand.logo);
    const pick = document.querySelector<HTMLElement>('#pick-logo');
    if (pick) pick.textContent = has ? 'Replace logo' : 'Upload logo';
    document.querySelector<HTMLElement>('#match-logo')!.hidden = !has;
    document.querySelector<HTMLElement>('#remove-logo')!.hidden = !has;
    const showLabel = document.querySelector<HTMLElement>('#show-label');
    if (showLabel) showLabel.textContent = has ? 'Show logo' : 'Show initials';
    form!.querySelector<HTMLSelectElement>('[data-brand="size"]')!.value = brand.size;
    form!.querySelector<HTMLInputElement>('[data-brand="show"]')!.checked = brand.show;
    // A watermark is made from the uploaded image, so it has nothing to offer without one.
    document.querySelector<HTMLElement>('#watermark-option')!.hidden = !has;
    form!.querySelector<HTMLInputElement>('[data-brand="watermark"]')!.checked = brand.watermark;
  }

  /** Sets the accent to the logo's main colour, and the headings to a dark shade of it. */
  async function matchLogo(announce: boolean): Promise<boolean> {
    if (!brand.logo) return false;
    const colour = await logoColour(brand.logo).catch(() => null);
    if (!colour) {
      if (announce) setStatus(logoStatus, 'Your logo has no strong colour to match, so the colours stay as they are.');
      return false;
    }
    update((draft) => {
      draft.look = normaliseLook({ ...draft.look, accent: colour, heading: headingFor(colour) }, draft.look);
    });
    syncControls();
    if (announce) setStatus(logoStatus, 'Colours matched to your logo.');
    return true;
  }

  async function useLogoFile(file: File): Promise<void> {
    setStatus(logoStatus, 'Reading the logo…', 'busy');
    try {
      const { src, ratio } = await prepareLogo(file);
      // Match colours only when they are still the defaults, so a chosen look is never overwritten.
      const untouched =
        state.look.accent === defaultLook.accent && state.look.heading === defaultLook.heading;
      const saved = setBrand({ logo: src, ratio, show: true });
      const matched = untouched && (await matchLogo(false));
      const parts = [matched ? 'Logo added, and the colours matched to it.' : 'Logo added.'];
      if (!saved) parts.push('This browser could not save it, so it will be gone after you close the tab.');
      setStatus(logoStatus, parts.join(' '), saved ? 'idle' : 'error');
    } catch (error) {
      setStatus(logoStatus, error instanceof Error ? error.message : 'That image could not be read.', 'error');
    }
  }

  logoFile?.addEventListener('change', () => {
    const file = logoFile.files?.[0];
    if (file) void useLogoFile(file);
    logoFile.value = ''; // so choosing the same file again still fires
  });

  // Dropping an image on the logo box or the preview uses it as the logo.
  for (const zone of [document.querySelector<HTMLElement>('#logo-box'), document.querySelector<HTMLElement>('#pane-preview')]) {
    if (!zone) continue;
    zone.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      zone.classList.add('is-dropping');
    });
    zone.addEventListener('dragleave', (event) => {
      if (!zone.contains(event.relatedTarget as Node | null)) zone.classList.remove('is-dropping');
    });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('is-dropping');
      const file = event.dataTransfer?.files[0];
      if (file) void useLogoFile(file);
    });
  }

  /** "Start a new document" also forgets what the AI boxes were doing. */
  function forgetAi(): void {
    draftController?.abort();
    styleController?.abort();
    window.clearTimeout(draftTimer);
    window.clearTimeout(styleTimer);
    aiIds = new Set();
    lastDrafted = '';
    lastStyled = '';
    if (draftBox) draftBox.value = '';
    if (styleBox) styleBox.value = '';
    setStatus(draftStatus, '');
    setStatus(styleStatus, '');
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
    showAllErrors = true;
    const errors = renderErrors();
    if (errors.length) {
      showPane('form');
      const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      first?.focus({ preventScroll: true });
      say(
        errors.length === 1
          ? `Fix 1 thing before downloading: ${errors[0]!.message}`
          : `Fix ${errors.length} things before downloading. They are marked in red.`,
      );
      return;
    }

    const original = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Building PDF…';
    try {
      const tax = taxFor(state);
      const totals = computeTotals(state, tax.rate);
      const bytes = await buildPdf(state, totals, { taxLabel: tax.label, taxRate: tax.rate, brand });
      const name = `${kind}-${state.number || 'draft'}.pdf`;
      downloadPdf(bytes, name);
      say('PDF downloaded.');
    } catch (error) {
      console.error(error);
      // The PDF library loads on first click; after a redeploy (or a dev
      // server re-optimising its deps) the old file is gone until a reload.
      const stale =
        error instanceof TypeError &&
        /dynamically imported module|Importing a module script failed/i.test(error.message);
      say(
        stale
          ? onLocalhost
            ? 'The dev server lost the PDF library. Restart it (Ctrl+C, then npm run dev) and reload.'
            : 'The PDF tool needs a page refresh. Your invoice is saved, so reload and try again.'
          : 'The PDF could not be built. Check the amounts and try again.',
      );
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
  syncBrandControls();
  renderItemList();
  renderPreview();
  measure(); // synchronously, so the first frame is already correct
}
