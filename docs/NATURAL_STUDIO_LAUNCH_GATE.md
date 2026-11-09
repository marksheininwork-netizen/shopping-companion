# Natural Studio Commerce launch gate

Status: internal draft, not customer policy and not approval to launch.

## Storefront and catalog

- The new storefront is an additional page in the Shopping Companion repository at `/commerce.html`; it is not deployed.
- Product cards are concept drafts. Prices are suggested placeholders. Supplier costs, shipping, stock, tax, sizes, materials, and production times are not verified.
- The research cart is local and does not initiate checkout.
- GiftFinder filters the draft concept catalog only.
- PriceWatch stores prices and timestamps entered manually by the user. No retailer data is fetched and no alerts are sent.
- Affiliate Shopping is inactive. There are no verified partner accounts or commission links.

## Required before sales

- Inspect the current Printify catalog, select exact product/print provider/variants, produce supplier mockups, and confirm base costs and shipping. Existing storefront data must be preserved.
- Review each final artwork, print template, proof, product description, price, category, metadata, and rights record.
- Confirm seller identity, tax treatment, customer support address and process, privacy notice, Terms, returns/refunds, and shipping commitments.
- Choose the intended Stripe account and confirm test-mode checkout, webhooks, receipts, failed payment behavior, fulfillment and refund handling.
- Run an end-to-end test purchase and cancellation/refund flow before live sales.
- Obtain owner approval before publishing listings, merging release code, or enabling live payments.

## Customer policy drafts

Privacy, Terms, Returns, and Shipping copy on the preview page is explicitly marked draft. It must be reviewed against actual data handling and fulfillment before publication. The Contact page stores a message draft locally and does not send it; a support channel is not configured.
