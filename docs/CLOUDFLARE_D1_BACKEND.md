# Natural Studio Commerce Cloudflare backend

This is a separate, staging-only Worker and D1 database named `natural-studio-commerce-development`. It does not bind to or edit another business's Worker or D1 database.

## Authentication and data access

Customer routes are under `/api/v1/customer/*` and require a Cloudflare Access identity supplied by the Worker runtime. Configure an Access application for the exact staging Worker path and allow email one-time-PIN sign-in. The app stores the Access subject and normalized email in this NSC database. Every order, support request, and download query scopes by that subject. If Access is missing or cannot verify an identity, the route fails closed.

Only active catalog records are public. Current digital products remain drafts with no checkout price, so checkout cannot sell them.

## Orders, payments, and delivery

Checkout is hosted by Stripe and disabled by default. The server accepts only a `sk_test_` secret and `CHECKOUT_ENABLED=true`; both encrypted Worker secrets still need to be configured from the selected Maria Sheinin test account. A raw-body Stripe signature with a five-minute timestamp window is verified before processing events. Payment amount, currency, session ID, order ID, and owner are checked before entitlement. The Worker serves the archive bytes only after the same Access subject has a paid order. Assets are stored as base64 rows in this isolated D1 database; there is no public asset URL.

No live charge or customer checkout is enabled by this configuration.

## Customer support

Account-scoped support requests are stored in the private NSC D1 database with a five-request/hour limit. No customer message is sent by email. A monitored support address and fulfillment process still need owner approval and configuration.

## Free plan limits

Cloudflare D1 is available on Workers Free: 10 databases, up to 500 MB per database, with 5 GB total storage per account. Free daily row-read/write limits are enforced and queries fail until 00:00 UTC if a limit is exceeded. Monitor usage before launch and keep this backend within the free allowances. Never upgrade to Workers Paid without owner approval.
