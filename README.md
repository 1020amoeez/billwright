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

## Notes

- The homepage and template gallery ship no JavaScript. pdf-lib (435KB) is
  imported only when Download PDF is clicked.
- Fonts are self-hosted from `public/fonts/`, so the site makes no external
  requests at all.
- Lighthouse mobile scores 100 across performance, accessibility, best
  practices and SEO.

`CHANGELOG.md` records the decisions taken where the brief and the design files
disagreed, and what is still open.
