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

## AI draft (optional)

The generator has a "Describe the work" box that turns a sentence into line
items. It is the only part of the site that makes a network request with
anything the user typed, it runs only on an explicit button press, and it sends
that sentence alone — never the client, the business details, the existing
items or the totals. Amounts are still totalled locally by `computeTotals`.

It is a Cloudflare Pages Function (`functions/api/draft-items.ts`) calling
Claude Haiku 4.5 with structured outputs, so the API key never reaches the
browser. Roughly $0.0014 per draft with the system prompt cached.

**The site works without it.** With no key configured the endpoint returns 503
and the box reports that drafting is unavailable; every other feature is
unaffected.

### Setting it up

```bash
# Local
cp .dev.vars.example .dev.vars   # add your key, keep AI_ALLOW_UNLIMITED=true
npm run dev:functions            # http://localhost:8788
```

For production, in the Cloudflare Pages project:

1. **Settings → Variables → Add secret**: `ANTHROPIC_API_KEY`
2. **Workers & Pages → KV → Create namespace**, then bind it to the Pages
   project under **Settings → Bindings** with the variable name `AI_LIMITS`
3. Optionally set `AI_DAILY_LIMIT` (defaults to 20 drafts per IP per day)

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
