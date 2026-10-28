# Natural Studio Commerce — Shopping Companion integration

## Verified baseline (2026-10-28)
- Existing Vite + React + TypeScript application, maintained in this repository.
- Shopping lists: Wishlist, Must Buy, Groceries, Recurring, Buy Later.
- Local browser storage, JSON import/export, item prices, stores, links, priorities, quantities and filtering.
- No verified live merchant pricing, price alerts, affiliate tracking or payment integration. Do not represent estimated prices as real-time prices.

## Next safe development milestones
1. Improve accessibility, mobile navigation, and resilient local storage with validation.
2. Add a product comparison workspace with manually entered offers, currency, shipping and tax estimates, and timestamps.
3. Add a local price-history journal with charts; label manual observations distinctly from automated price tracking.
4. Build GiftFinder with budget, interests and recipient filters, without collecting unnecessary personal information.
5. Introduce opt-in price alerts only after a reliable compliant data source and delivery method are configured.
6. Add affiliate links with prominent disclosure, clear outbound-link labeling, and no misleading savings claims.
7. Keep Natural Studio merchandise separate from neutral comparisons and clearly label sponsored or owned items.

## Operational boundaries
- No paid APIs, orders, subscriptions or advertising without explicit approval.
- Do not store API secrets in frontend code or GitHub.
- Do not scrape retailer sites against terms or claim unverified inventory or prices.
- Preserve existing customer data formats and support backup before migrations.

## Store launch checklist
- Confirm Printify account store, products, publication and payment status.
- Confirm print provider costs, shipping, tax, production funding, refund responsibility and payout timing.
- Start with a small original cohesive collection, check print-safe artwork and proof mockups.
- Calculate margin using retail price minus production, shipping subsidy, transaction/platform fees, taxes borne by seller, and refund reserve.
- Publish only after product details and financial exposure are reviewed.
