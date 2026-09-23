# Changelog

Decisions taken while building Billwright that the brief or `design/` did not
settle. Each one is reversible; they are grouped by the reason they came up.

## Conflicts between the brief and the design files

The instruction was to follow the design files where the two disagree.

- **Eight countries, not five.** The brief names Pakistan, UAE, UK, India and
  the US. The country strip in `Main.dc.html` shows eight, so the data set is
  eight: those five plus Saudi Arabia, Australia and Canada. Adding another is
  one file in `src/data/countries/` and one line in its `index.ts`.
- **Tax rates are the design's, not today's.** `Generator.dc.html` shows
  Pakistani sales tax at 17%. The current standard rate is 18%. The design won.
  Rates live in `src/data/countries/*.ts` and are a one-line change each.
- **Six templates in the generator's picker.** The picker in `Generator.dc.html`
  lists three; the gallery in `Templates.dc.html` shows six and every card links
  into the generator. The picker lists all six.
- **The country lives in the tax select.** The brief says a country setting
  drives tax, currency and formatting. The generator's top bar, as drawn, holds
  only Template and Currency, so the country rides in the tax options
  ("Sales tax 17% (Pakistan)") rather than getting a control the design has no
  room for.

## Additions the design does not show

- **Invoice number and issue date fields.** The preview prints both, but the
  form has no input for either. A generator whose invoice number cannot be
  changed is not usable, so a second two-column row was added under "Bill to",
  matching the existing rhythm.
- **A tax rate box for the US.** There is no national US sales tax — it is set
  by state and often by city — so `taxRate` is nullable. When the selected
  country has no standard rate, or "Other rate" is chosen, a rate field appears.
- **"Start a new invoice".** Clears the saved document. Without it, the only way
  to empty the form is to clear browser storage.
- **Native date inputs.** The design draws due date as a text box reading
  "12 Oct 2026". `type="date"` gives a picker, real validation and correct
  locale handling; the preview still renders "12 Oct 2026".
- **Pages below 1440px.** No artboard exists for any narrower screen. The
  generator becomes Form/Preview tabs below 900px, the nav collapses to a
  disclosure menu below 1000px, and grids drop to two then one column. The
  design's 36px and 40px controls come up to 44px on touch widths.
- **Three template variants were extrapolated.** Only the Classic sheet is drawn
  at full size. Bold header, Compact, Minimal, Ledger and Contractor were built
  out from their gallery thumbnails.
- **`/calculators`, `/guides`, `/privacy`, `/contact`, `/404`.** The nav and
  footer link to all of these; none had a design. They follow the site pattern.

## Colours and type

- Five colours appear in the markup but not in the token table:
  `#C9CFDB` (explainer prose), `#6B7488` (ad slot label) and the three greys in
  the template thumbnails. All are now tokens.
- **`#6B7488` was lightened to `#7E8698`.** The original computes to 3.96:1 on
  the page background, under the 4.5:1 the brief requires.
- **Focus rings do not change an element's radius.** The ring is 2px accent at
  2px offset; the element keeps its own corner radius so nothing shifts.

## Performance

- **Fonts are self-hosted, not loaded from Google Fonts.** The Google Fonts
  stylesheet was render-blocking and cost about 1.7s on a simulated mobile
  connection, holding the homepage at 94. The same files, served from
  `/fonts/`, take every page to 100. The site now makes no external request at
  all, which is also why the privacy page claims none.
- **Bricolage Grotesque keeps its optical-size axis** (`opsz,wght@12..96`).
  Without it the 72px headline sets wider and wraps onto a different line than
  the design.
- **pdf-lib is imported on click.** It is 435KB, so it is dynamically imported
  inside the Download PDF handler rather than shipped with the page. The
  homepage and template gallery ship no JavaScript at all.

## The PDF

- **Helvetica, not the site's fonts.** Embedding Bricolage and IBM Plex would
  add roughly 100KB to the download and require fontkit. The standard PDF fonts
  cost nothing and print cleanly.
- **Text is folded to WinAnsi before drawing.** pdf-lib's standard fonts throw
  on characters outside that set, so smart quotes and dashes are converted and
  anything unmappable is dropped rather than crashing the download.
- **Long invoices paginate.** An early version drew only the rows that fit on
  one sheet while still totalling all of them, which would have produced a PDF
  whose lines did not add up to its total. Rows now carry onto further sheets,
  the table header repeats, and the footer reads "Page 2 of 3". The preview
  grows in the same way and reports the same count.

## Homepage redesign and theming

The homepage was rebuilt as a product page rather than a card list, and a
dark/light theme was added across the whole site.

### Theming

- **Dark stays the default and the no-JS fallback.** An inline script in
  `BaseLayout` sets `data-theme` before first paint from localStorage, falling
  back to `prefers-color-scheme`. There is no flash and no layout shift.
- **The approved dark values are untouched.** Light is a new palette on a warm
  off-white (`#F7F6F3`), not a pure white, with white cards over it.
- **Accent had to be split.** `#FFB020` is 1.7:1 on an off-white ground, so it
  is unusable as text there. `--accent` stays the brand fill (buttons, marks,
  the chip) and a new `--accent-text` (`#8A5A00` in light) carries any accent
  *text* or the focus ring. Five components were using the raw accent as a text
  colour, including the 56px calculator result; all now use `--accent-text`.
- **Light needed darker greys.** `--text-muted` and `--text-faint` are darker in
  light mode than their dark-theme counterparts; the originals measured 3.7–3.8:1
  on white. Both themes now pass 4.5:1 across every text/background pair on the
  homepage (49 combinations checked, zero failures).
- **Theme transitions are scoped to the switch.** A class is added to `<html>`
  for 240ms and removed, so no transition cost is carried during scrolling.

### Homepage

- **No animation library.** The project had none, and adding Framer Motion would
  mean adding React to a site that ships 0KB of JavaScript on most routes.
  Motion is CSS transitions and keyframes; the JavaScript is one 4KB module for
  scroll reveal, the hero loop, the demo and the country selector. Total blocking
  time stays at 0ms and the page still scores 98–100 on mobile.
- **The headline was kept.** The brief offered "Professional invoices. Made in
  under a minute." The existing line is in the design files, has more voice and
  follows the copy rules, so it stayed.
- **The demo is wired to the real logic.** It calls the same `computeTotals`,
  the same formatters and the same country data as the generator, so its numbers
  cannot drift from the product. It is deliberately a controlled subset, not a
  second generator.
- **Facts are counted, not claimed.** The strip reads its numbers from the
  shipped data (8 countries, 6 templates, 8 tools). There are no invented usage
  statistics anywhere on the page.
- **The country selector uses the real country files**, including the US case
  where there is no national rate and the tax row disappears.
- **The footer links only to pages that exist.** The brief suggested About,
  Terms and Help; rather than ship dead links, the columns are Documents,
  Calculators and More.
- Superseded components (`HeroPaper`, `ToolGrid`, `CountryStrip`) were deleted
  rather than left in place.

## AI draft (opt-in)

The generator's fixed line-item rows were the weakest part of the product, so a
"Describe the work" box turns a sentence into structured items.

- **It breaks the local-first claim, so the claim changed.** Everything else
  still runs in the browser, but this button sends the sentence you typed to a
  Cloudflare Pages Function, which calls Claude. The hero, the value section,
  the generator's footer note and the privacy page were all rewritten to say so
  — the privacy page has a section naming exactly what is and is not sent.
- **What is sent is only the description.** Not the client, the business
  details, the invoice number, the dates, the existing items, the totals or the
  notes. Totals are still computed locally by `computeTotals`.
- **Claude Haiku 4.5**, chosen on cost: roughly $0.0014 per draft with the
  system prompt cached, against about $0.007 on Opus 5. At Pakistani ad rates
  (~$1 RPM) Opus would have cost more than the pageviews earn at moderate
  adoption; Haiku stays profitable, and the task — turning a sentence into line
  items — does not need more.
- **Structured outputs** (`output_config.format` with a zod schema) rather than
  parsing free text, so a malformed response is caught rather than half-read.
- **The model never touches money logic.** It may not compute totals, apply
  tax or choose a rate; it returns descriptions, quantities and unit prices,
  and returns 0 for any price the text does not state so the person fills it in.
- **The quota fails closed.** Without the `AI_LIMITS` KV binding the endpoint
  returns 503 instead of billing an uncapped key. Default is 20 drafts per IP
  per day; `AI_ALLOW_UNLIMITED` bypasses it and is local-development only.
- **The feature is optional.** With no key configured the box reports that
  drafting is unavailable and nothing else changes.

## Still open

- **Word and Excel downloads.** `Templates.dc.html` says they are available and
  the Format filter offers them. The filter works against a `formats` field per
  template, but nothing generates `.docx` or `.xlsx` yet — "Use template" always
  opens the generator. Either build the exporters or soften the copy.
- **The AI endpoint has never been run against the live API.** There were no
  Anthropic credentials in the environment it was built in, so the client path,
  both failure paths and the append/replace behaviour were verified against a
  stubbed endpoint; the model call itself is unexercised. First real run should
  be `npm run dev:functions` with a key in `.dev.vars`.
- **The contact page has no address.** It explains what is useful to report but
  cannot say where to send it. Add a real inbox before launch.
- **Ad slots exist only on tool pages**, as drawn. If the homepage or gallery
  should carry units too, that is a design question.
- **The homepage has no ad slot.** It is now the longest page on the site and
  the obvious place for a unit, but the design never specified one.
- **The project directory name ends in a space** (`Invoice tools `). It has not
  broken anything so far, but it is worth renaming before wiring up CI.
