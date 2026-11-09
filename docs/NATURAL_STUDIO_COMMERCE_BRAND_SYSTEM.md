# Natural Studio Commerce brand system

Status: working system proposal for the GitHub-managed commerce portfolio. This document defines interface and content rules; it does not claim a registered company name, product catalog, supplier approval, or live sales readiness.

## Portfolio structure

- **Natural Studio** — print-on-demand clothing, mugs, accessories, stationery, and home goods.
- **Digital Design Shop** — original downloadable printables and design assets.
- **Niche Collections** — themed groupings across approved products.
- **Shopping Companion** — private, browser-local shopping lists, saved items, budgets, and manual comparisons.
- **GiftFinder** — guided gift discovery from recipient interests and a spending range.
- **PriceWatch** — user-requested tracking and alerts only when a compliant source and delivery method are configured.
- **Affiliate Shopping** — recommendations only after an authorized affiliate relationship and accurate source data exist.

Use Natural Studio Commerce as the portfolio umbrella. Keep the existing Natural Studio Printify storefront and Northstar digital-products project separate until the owner chooses a migration plan. Do not rename, merge, or overwrite an existing store as part of this system.

## Visual language

- **Forest** `#28574C`: primary actions and links.
- **Sage** `#91A58C`: secondary emphasis and soft gradients.
- **Warm paper** `#F6F3ED`: page backgrounds.
- **Ink** `#23332D`: primary text.
- **Clay** `#C67C57`: occasional accent for highlights; preserve strong contrast for text.
- **Typography**: DM Sans for everyday interface copy; use a clear serif display face only for campaign headings when available.
- **Shapes**: softly rounded cards, thin warm-gray borders, generous spacing, quiet botanical cues. Product graphics must remain legible at print scale and avoid imitating third-party logos or characters.

## Voice and merchandising

Write plainly, warmly, and specifically. Describe the material, format, dimensions, included files, use, care, production method, and fulfillment timing only when those details are verified. Label user-entered prices and calculated totals as estimates. Never invent reviews, discounts, stock levels, price histories, shipping promises, or affiliate relationships.

Every product record should have: division, collection, original title, one-sentence value, full description, category, materials or file formats, dimensions, variants, SKU or internal ID, verified base cost, verified shipping, price rationale, margin estimate, SEO title, meta description, alt text, rights/source record, and publication status.

## Trust and launch rules

- Keep product drafts and designs in review until the owner approves publication.
- Never switch Stripe into live mode or expose payment secrets in GitHub.
- Keep test and live payment configuration separate.
- Disclose affiliate links beside recommendations, and use them only after the relationship is confirmed.
- Do not scrape retailer pages or describe manual observations as automated monitoring.
- Collect only the information needed for a requested feature; shopping lists in this app remain in the browser's local storage.
- Maintain accessible labels, keyboard operation, readable contrast, and mobile layouts.
- Keep policies accurate to actual operations; do not publish unsupported shipping, returns, privacy, or support promises.
