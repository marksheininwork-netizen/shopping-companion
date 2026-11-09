# Natural Studio Commerce launch gate

Status: internal staging readiness record. This is not customer policy, legal advice, or approval to launch.

## Verified deployment and test results

- PR [#4](https://github.com/marksheininwork-netizen/shopping-companion/pull/4) remains open and draft. The integration branch is `natural-studio-commerce-integration`; Verified at code/test commit `cf50db56dd8208a49275981260cfceb970f55745`; this document refresh records the results.
- Separate staging Pages project: [natural-studio-commerce-staging.pages.dev](https://natural-studio-commerce-staging.pages.dev). The latest verified code deployment is [31083b6a.natural-studio-commerce-staging.pages.dev](https://31083b6a.natural-studio-commerce-staging.pages.dev), built from the code/test commit above. It is not the existing Shopping Companion production Worker.
- Pages project `natural-studio-commerce-staging` is bound to the dedicated D1 database `natural-studio-commerce-development` (`277ba940-6c62-4489-b29e-64dd7104b9d5`). No Northstar Studio, MindSpark, FlowPilot, or Daylight Labs database is bound to it.
- GitHub Actions for the verified head passed: Build and validate run #75 (`42677255710`) and Commerce tools tests run #51 (`42677255670`). They include build/type validation, automated commerce/security regression coverage including direct Cloudflare Access JWT signature/claim checks, desktop and mobile Playwright checks, and an HTTP probe against the deployed staging site.
- Live unauthenticated staging HTTP results from the probe: storefront `GET /commerce` returned 200; `GET /api/v1/customer/me` and `GET /api/v1/customer/downloads/{id}` each returned 302 to the configured Cloudflare Access sign-in. The page returned noindex metadata, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`. This proves the public gate is active; it does not prove signed-in account behavior.
- Automated browser checks exercise desktop and mobile layouts at a local preview, including account UI, draft-only checkout disabled, product discovery, saved ideas, local PriceWatch observations, support drafts, and Shopping Companion budget/comparison/backup persistence. These browser tests do not authenticate to the deployed Access gate.

## Authentication and live account tests

- Customer API routes are behind the staging Cloudflare Access application and the Pages Function independently verifies the signed Access JWT (issuer, audience, time bounds, key ID, and RS256 signature). The D1 tables are isolated by the verified Access subject.
- The current Access identity provider is verified email PIN. Its policy allows users who complete that configured sign-in method; there is no NSC-specific seeded test identity or documented non-email test authentication. No authentication bypass is configured or appropriate.
- An actual PIN flow needs an authorized inbox and the PIN delivered to it. No email PIN was requested or consumed for this verification. Do not use identities or sessions belonging to another business as NSC customers.
- A live read-only D1 count found 0 customer rows, 0 orders, 0 support requests, and 0 webhook events; the database contains 2 draft, unpriced products and 2 private asset rows. Thus live cross-user isolation, persistent signed-in profiles, signed-in support submission, order ownership, paid download delivery, and denial of an unpaid download remain unverified. The automated backend tests cover fail-closed checkout, signature validation, paid status, and order ownership with test fixtures; fixtures are not live customer tests.

## Product and file readiness

- The two Small Rituals digital products are still `draft`, are not published, and have `price_cents = NULL`. The two prepared ZIP archives passed archive-integrity checks and contain the expected SVG/PDF files, draft personal-use license, and read-me. SHA-256 checksums and file lists are recorded in [NATURAL_STUDIO_PRODUCT_DRAFTS.md](NATURAL_STUDIO_PRODUCT_DRAFTS.md).
- Storefront previews are original vector concept images, not Printify supplier mockups or production proofs. The ZIP packages are review deliverables, not authorized purchase downloads. Draft licenses require owner/legal review of the legal seller, rights-holder, jurisdiction, consent, refund, and accessibility terms.
- Product archive bytes are currently stored in the dedicated D1 database, not public GitHub or a public asset URL. This is acceptable only as a small staging arrangement; choose and verify a private object store before expanding delivery. R2 is not enabled, and must not be enabled if it would incur a cost without approval.

## Stripe TEST account and checkout gate

- The selected connector account is Maria Sheinin, `acct_1UVfQbPKQ5OP9J0x`, with `livemode=false`. Read-only inspection found an existing test catalog containing other-business products, including Northstar Studio items. None of those catalog items or prices are approved for NSC, and this work did not modify them.
- No verified NSC product/price mapping exists. The NSC D1 products remain drafts with no sale price. Do not reuse the other-business Stripe products or prices.
- The staging API Worker has `CHECKOUT_ENABLED=false`; no `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is configured. Hosted Checkout creation and real signed Stripe delivery are therefore not runnable. Do not set the enable flag until the owner confirms an isolated NSC test catalog/price mapping and test credentials.
- Required secret names, stored only as encrypted Worker secrets when authorized: `STRIPE_SECRET_KEY` (must be `sk_test_`), `STRIPE_WEBHOOK_SECRET` (Stripe test endpoint `whsec_`). Keep plain-text `CHECKOUT_ENABLED=false`. Proposed test webhook destination: `https://nsc-commerce-api-staging.marksheininwork.workers.dev/api/v1/webhooks/stripe`. Never put values in GitHub, Pages variables, client code, or logs.

## Printify and physical products

- Printify read/catalog operations are not available through the connected integration. No provider, variant, supplier base cost, shipping charge, inventory, or production time is verified.
- Owner authorization needed: reconnect the approved Printify integration using read-only `shops.read`, `products.read`, `catalog.read`, and `print_providers.read` scopes for the existing Natural Studio shop. No write scope is needed for catalog review. Until then, physical listings remain concepts and must not be published.

## Public customer authentication design

Cloudflare Access is suitable for the private staging/admin gate, not an open consumer login. For a future public store, retain Access on admin/staging routes and implement a separate customer identity layer: OIDC Authorization Code with PKCE, verified issuer/audience/state/nonce, stable issuer-plus-subject account mapping, short-lived random opaque sessions with only token hashes stored in D1, Secure/HttpOnly/SameSite cookies, session rotation/revocation, CSRF protection on mutations, rate limits, verified email, and owner-scoped database queries. Select and authorize the identity provider, email delivery, retention, and recovery policies before public rollout. Do not treat an email address alone as a stable account ID when a provider subject is available.

## Remaining owner decisions before launch

1. Provide an authorized staging PIN inbox/session (and a second distinct authorized identity) to complete live two-user isolation, signed support, and ownership/download checks.
2. Decide whether the Maria Sheinin Stripe test account can have a separately identified NSC test catalog, or authorize a dedicated Stripe test environment/account. Supply test secrets only through Cloudflare Worker secret settings after NSC prices are approved.
3. Reauthorize Printify read scopes and approve final supplier-linked products, prices, and shipping.
4. Confirm legal seller/rights-holder, approved product prices/licenses, customer support destination, and final customer policies before sales.
5. Keep PR #4 in draft; do not merge, publish products, switch checkout on, or alter production without explicit approval.
