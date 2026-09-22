# Billwright — design spec

Free, no-login invoice and small-business tools site. Dark UI, one amber accent, white "paper" invoice previews.
The four `.dc.html` files in this folder are the source of truth for layout, spacing and copy. They are plain HTML with
inline styles: open them in a browser to see the screens, and read the markup for exact values.

## Tokens

| Token          | Value     | Use                                  |
|----------------|-----------|--------------------------------------|
| bg             | #101522   | page background                      |
| bg-deep        | #0B0F19   | preview/stage areas behind paper     |
| panel          | #171D2C   | cards, inputs, sidebar blocks        |
| border         | #2B3448   | card borders, dividers               |
| border-strong  | #3A4459   | input borders, outline buttons       |
| hairline       | #1F2738   | nav/footer rules                     |
| text           | #F3F5F9   | primary text                         |
| text-muted     | #A9B1C3   | secondary text, labels               |
| accent         | #FFB020   | buttons, links-on-hover, highlights  |
| paper          | #FFFFFF   | invoice sheet                        |
| paper-ink      | #151A28   | text on paper                        |
| paper-muted    | #66708A   | secondary text on paper              |
| paper-line     | #E6E8EF   | table rules on paper                 |

Text on accent buttons is `bg` (#101522), never white.

## Type

- Display: Bricolage Grotesque (Google Fonts), 600–700. Headlines, invoice "Invoice" wordmark, big numbers.
- Body/UI: IBM Plex Sans, 400/500/600. Everything else. `font-variant-numeric: tabular-nums` on all money and quantities.
- Scale used: 72 / 56 / 44 / 36 / 32 / 28 / 24 / 22 / 20 / 18 / 17 / 16 / 15 / 14 / 13 px. Headline letter-spacing −0.02 to −0.03em.

## Shape and spacing

- Radius: buttons 10–12px, cards 14px, large sections 18–20px, inputs 8–10px, paper 4–6px. Pills 999px.
- No drop shadows on cards. Only the paper sheet has a shadow: `0 40px 80px rgba(0,0,0,.55)` (hero), `0 30px 60px rgba(0,0,0,.6)` (generator).
- Page gutter 120px at 1440; content max-width 1200. Section padding 96px vertical.
- Controls ≥44px tall. Inputs 44px (52px in calculators).
- Icons: inline stroke SVG, 1.8–2.2 stroke, accent color. No emoji, no icon fonts.

## Screens

1. `Main.dc.html` — Homepage. Hero (headline left, tilted invoice paper right, −2°), 6-tool grid (3 cols), country strip, 3-step how-it-works, footer.
2. `Generator.dc.html` — Invoice generator. Top bar with template + currency selects and "Download PDF". Left 560px form; right live A4 preview on `bg-deep`.
3. `Templates.dc.html` — Template gallery. Filters (profession, country, format), 3-col grid of template cards with mini previews.
4. `Tool.dc.html` — SEO tool page pattern (profit margin calculator). Calculator card, explainer + formula block + FAQ (`<details>`), sticky sidebar with related tools, 300×250 ad slot, accent CTA card.

## Behaviour to implement

- Everything client-side. Invoice state saved to localStorage; PDF generated in-browser (pdf-lib or jsPDF).
- Country picker sets tax label/rate, currency code and number format.
- One route per tool; each tool page follows the `Tool.dc.html` pattern with its own explainer and FAQ.
- Responsive: single column below 900px; generator becomes form-then-preview tabs on mobile.
- Respect `prefers-reduced-motion`. Visible focus rings (accent, 2px).

## Copy rules

Sentence case. Plain verbs. Buttons say what happens ("Download PDF", "Make an invoice"). No all-caps labels, no eyebrows, no arrows appended to links.
