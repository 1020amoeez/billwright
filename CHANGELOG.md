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

## Still open

- **Word and Excel downloads.** `Templates.dc.html` says they are available and
  the Format filter offers them. The filter works against a `formats` field per
  template, but nothing generates `.docx` or `.xlsx` yet — "Use template" always
  opens the generator. Either build the exporters or soften the copy.
- **The contact page has no address.** It explains what is useful to report but
  cannot say where to send it. Add a real inbox before launch.
- **Ad slots exist only on tool pages**, as drawn. If the homepage or gallery
  should carry units too, that is a design question.
- **The project directory name ends in a space** (`Invoice tools `). It has not
  broken anything so far, but it is worth renaming before wiring up CI.
