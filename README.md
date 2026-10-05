# Billwright

Free invoice generator, quotation and receipt makers, and small-business
calculators. No accounts, no uploads, no backend — every document is built and
exported inside the browser tab.

Built with Astro (static output), TypeScript and plain CSS. Deploys to
Cloudflare Pages.

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site into dist/
npm run preview  # serve the production build
npm run check    # astro + TypeScript diagnostics
```

## What's in here

| Path | What it holds |
|---|---|
| `src/pages/` | One file per route |
| `src/layouts/` | `SiteLayout` (marketing), `AppLayout` (generator), `ToolLayout` (calculator pages), `PageLayout` (prose) |
| `src/components/` | Grouped by area: `chrome`, `home`, `invoice`, `templates`, `tool`, `sidebar`, `ui` |
| `src/scripts/` | Browser logic — invoice state, PDF export, calculators |
| `src/data/` | Countries, templates and the tool list |
| `src/styles/` | Design tokens and shared stylesheets |
| `design/` | The approved design files this was built from |

## Adding things

**A country** — add one file to `src/data/countries/` and one line to its
`index.ts`. Tax label, rate, currency, locale and tax-ID name all live there.
A `taxRate` of `null` means the user enters the rate themselves (the US has no
national rate).

**A calculator** — add an entry to `src/data/tools.ts`, a function to
`src/scripts/calculators/registry.ts`, and a page using `ToolLayout` plus the
`Calculator` component. The registry key matches the page's `calc` prop.

**An invoice template** — add it to `src/data/templates.ts`, a thumbnail branch
in `TemplateMini.astro`, and a `.paper--<id>` block in `src/styles/paper.css`.

## AI assist (optional)

Two boxes in the generator use Claude Haiku 4.5, and both act on a pause in
typing rather than a button:

- **Describe the work** (`functions/api/draft-items.ts`) turns a sentence into
  line items. Each redraft replaces the rows the last one made; a row edited by
  hand is kept. Amounts are still totalled locally by `computeTotals`.
- **Describe the look** (`functions/api/style.ts`) sets the accent colour,
  heading colour, font and template ("make it navy with a serif font"). Colour
  names, fonts and template names are read instantly on the device
  (`src/scripts/lookWords.ts`) and work with no key; AI handles the rest. Any
  heading colour is darkened until it reads on white (`src/scripts/look.ts`).

Only the box's text leaves the browser (the style box adds the current colours
and template), never the client, the business details or the totals. The API
key stays on the server. Roughly $0.0014 per call.

**Logo** (`src/scripts/brand.ts`): an uploaded PNG, JPG or SVG is downscaled
in the browser and stored under its own key, shared by all three document
types and kept by "Start a new". SVGs are rasterised because pdf-lib embeds
only PNG and JPEG. With no logo the business's initials show on the accent.
An optional watermark puts a large faint copy of the logo (7% opacity) behind
the first sheet in the preview and every page of the PDF. "Match colours"
reads the logo's main colour; it runs on upload only while the
colours are still the defaults. The image is never sent anywhere — the style
box sends the logo's size and visibility, not the picture.

**The site works without it.** With no key configured the endpoints return 503
and the boxes say so; every other feature is unaffected.

### Setting it up

```bash
# Local
cp .dev.vars.example .dev.vars   # paste your key after ANTHROPIC_API_KEY=
npm run dev                      # http://localhost:4321
```

`npm run dev` runs `functions/api/*` itself (a dev-only Vite middleware in
`astro.config.mjs`), re-reading `.dev.vars` on each request, so no restart is
needed after adding the key. `npm run dev:functions` still runs the real
Pages runtime through wrangler.

For production, in the Cloudflare Pages project:

1. **Settings → Variables → Add secret**: `ANTHROPIC_API_KEY`
2. **Workers & Pages → KV → Create namespace**, then bind it to the Pages
   project under **Settings → Bindings** with the variable name `AI_LIMITS`
3. Optionally set `AI_DAILY_LIMIT` (defaults to 100 AI calls per IP per day,
   shared by both boxes — live typing makes more calls than a button did)

The quota **fails closed**: without the `AI_LIMITS` binding the endpoint
returns 503 rather than billing your key with no ceiling. `AI_ALLOW_UNLIMITED`
bypasses it and is for local development only.

## Notes

- The homepage and template gallery ship no JavaScript. pdf-lib (435KB) is
  imported only when Download PDF is clicked.
- Fonts are self-hosted from `public/fonts/`, so the site makes no external
  requests at all.
- Lighthouse mobile scores 100 across performance, accessibility, best
  practices and SEO.

`CHANGELOG.md` records the decisions taken where the brief and the design files
disagreed, and what is still open.
