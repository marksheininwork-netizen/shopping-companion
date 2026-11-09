# Natural Studio Commerce launch gate

Status: internal staging readiness record. This is not customer policy, legal advice, or approval to launch.

## Verified deployment and test results

- PR [#4](https://github.com/marksheininwork-netizen/shopping-companion/pull/4) remains open, draft, and unmerged. The integration branch is `natural-studio-commerce-integration`; current verified head is `4a5caf6562e2da1a7a22d54097766846ea26d34e`.
- Separate staging Pages project: [natural-studio-commerce-staging.pages.dev](https://natural-studio-commerce-staging.pages.dev). The successful preview deployment for the verified head is [d5bd2e51.natural-studio-commerce-staging.pages.dev](https://d5bd2e51.natural-studio-commerce-staging.pages.dev). The Worker deployment is the separate staging service `nsc-commerce-api-staging`, not the existing Shopping Companion production Worker.
- Pages project `natural-studio-commerce-staging` is bound to the dedicated D1 database `natural-studio-commerce-development` (`277ba940-6c62-4489-b29e-64dd7104b9d5`). No Northstar Studio, MindSpark, FlowPilot, or Daylight Labs database is bound to it.
- GitHub Actions passed for the verified head: Build and validate run #99 (`42709907535`) and Commerce tools tests run #75 (`42709908005`). The latter passed GiftFinder/PriceWatch and security regression tests, Chromium desktop and mobile Playwright flows, and staging HTTP smoke checks for storefront headers, Access protection, the staging Worker, draft catalog, and unsigned webhook rejection.
- Live unauthenticated staging HTTP results from the probe: storefront `GET /commerce` returned 200; `GET /api/v1/customer/me` and `GET /api/v1/customer/downloads/{id}` each returned 302 to the configured Cloudflare Access sign-in. The page returned noindex metadata, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`. This proves the public gate is active; it does not prove signed-in account behavior.
- Automated browser checks exercise desktop and mobile layouts at a local preview, including account UI, draft-only checkout disabled, product discovery, saved ideas, local PriceWatch observations, support drafts, and Shopping Companion budget/comparison/backup persistence. These browser tests do not authenticate to the deployed Access gate.

## Authentication and live account tests

- Customer API routes are behind the staging Cloudflare Access application and the Pages Function independently verifies the signed Access JWT (issuer, audience, time bounds, key ID, and RS256 signature). The D1 tables are isolated by the verified Access subject.
- The current Access identity provider is verified email PIN. Its policy allows users who complete that configured sign-in method; there is no NSC-specific seeded test identity or documented non-email test authentication. No authentication bypass is configured or appropriate.
- An actual PIN flow needs an authorized inbox and the PIN delivered to it. No email PIN was requested or consumed for this verification. Do not use identities or sessions belonging to another business as NSC customers.
- A live read-only D1 count found 0 customer rows, 0 orders, 0 support requests, and 0 webhook events; the database contains 2 draft, unpriced products and 2 private asset rows. Thus live cross-user isolation, persistent signed-in profiles, signed-in support submission, order ownership, paid download delivery, and denial of an unpaid download remain unverified. Automated backend tests also cover support request persistence, customer-scoped listing, and the five-per-hour limit using fixture D1 data; fixtures are not live customer tests.

## Product and file readiness

- The two Small Rituals digital products remain `draft` and unpublished; their D1 prices are now mapped to the verified Stripe test Prices ($8 and $6). The two prepared ZIP archives passed archive-integrity checks and contain the expected SVG/PDF files, draft personal-use license, and read-me. SHA-256 checksums and file lists are recorded in [NATURAL_STUDIO_PRODUCT_DRAFTS.md](NATURAL_STUDIO_PRODUCT_DRAFTS.md).
- Storefront previews are original vector concept images, not Printify supplier mockups or production proofs. The ZIP packages are review deliverables, not authorized purchase downloads. Draft licenses require owner/legal review of the legal seller, rights-holder, jurisdiction, consent, refund, and accessibility terms.
- Product archive bytes are currently stored in the dedicated D1 database, not public GitHub or a public asset URL. This is acceptable only as a small staging arrangement; choose and verify a private object store before expanding delivery. R2 is not enabled, and must not be enabled if it would incur a cost without approval.

## Stripe TEST account and checkout gate

- The selected connector account is Maria Sheinin, `acct_1UVfQbPKQ5OP9J0x`, with `livemode=false`.
- Stripe read-only retrieval verified the two NSC-specific products and one-time Prices. Room to Grow is `prod_VbAkanXK0LziyQ` with active tax-exclusive Price `price_1UZyOaPKQ5OP9J0xCa2wqLn3` at USD 8.00. Some Things Take Time is `prod_VbAkmUaUL2bv6j` with active tax-exclusive Price `price_1UZyOcPKQ5OP9J0xl9zhNPoL` at USD 6.00. Both are test-mode products and use tax code `txcd_10505001`.
- The dedicated NSC D1 product rows now map to those Prices and amounts. Both catalog rows remain `draft`; public listing and customer checkout remain disabled. D1 currently has 0 orders and 0 webhook events.
- Stripe Tax settings are active in test mode and the reported test registration is active. A single test tax calculation for Room to Grow in a New York test jurisdiction returned `taxability_reason=product_exempt` and USD 0 tax. This verifies Stripe’s current test classification only; it does not establish the correct legal treatment. No tax code or shared tax setting was changed.
- The staging Worker has encrypted `STRIPE_WEBHOOK_SECRET` configured and its current staging source has been deployed; the code path includes test-only automatic tax, subtotal/tax/total verification, expired-session handling, and requires a test key plus webhook secret. One test-mode endpoint is active at `https://nsc-commerce-api-staging.marksheininwork.workers.dev/api/v1/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`; the duplicate endpoint created during setup was disabled. Signing secret values are never displayed or stored in source.
- PR #4 adds Stripe-hosted Checkout using the server-side D1 Price ID, test-only automatic tax, a randomized integration identifier, and validation/persistence of the tax-exclusive subtotal and final tax-inclusive total. The deployed staging Worker remains fail-closed: no `STRIPE_SECRET_KEY` is set and `CHECKOUT_ENABLED=false`.
- Actual hosted Checkout, signed Stripe delivery, order persistence, duplicate-event replay, failure/cancellation lifecycle, and paid/unauthorized download behavior have not been live-verified. They require an owner-created restricted test API key stored as the encrypted `STRIPE_SECRET_KEY` Worker secret and a signed-in authorized Access customer session. No real or test customer charge has been made.
- Before live sales, confirm legal seller disclosures and the applicable digital-product tax treatment with qualified advice, then configure separate live products/prices, live credentials, live tax registrations, production webhook, production checkout, and support/legal policies. Test Tax configuration is not a live registration.

## Printify and physical products

- Printify read/catalog operations are not available through the connected integration. No provider, variant, supplier base cost, shipping charge, inventory, or production time is verified.
- Owner authorization needed: reconnect the approved Printify integration using read-only `shops.read`, `products.read`, `catalog.read`, and `print_providers.read` scopes for the existing Natural Studio shop. No write scope is needed for catalog review. Until then, physical listings remain concepts and must not be published.

## Public customer authentication design

Cloudflare Access is suitable for the private staging/admin gate, not an open consumer login. For a future public store, retain Access on admin/staging routes and implement a separate customer identity layer: OIDC Authorization Code with PKCE, verified issuer/audience/state/nonce, stable issuer-plus-subject account mapping, short-lived random opaque sessions with only token hashes stored in D1, Secure/HttpOnly/SameSite cookies, session rotation/revocation, CSRF protection on mutations, rate limits, verified email, and owner-scoped database queries. Select and authorize the identity provider, email delivery, retention, and recovery policies before public rollout. Do not treat an email address alone as a stable account ID when a provider subject is available.

## Remaining owner decisions before launch

1. Sign into the Maria Sheinin Stripe Dashboard test mode, create a restricted test API key limited to Checkout Session creation (plus any minimum read access Stripe requires), and store it as the encrypted Cloudflare Worker secret `STRIPE_SECRET_KEY`. The staging Worker currently has no Stripe API key, and the connected account is not available in the logged-in browser session.
2. Complete an authorized Cloudflare Access PIN session for one staging customer and a second distinct authorized identity to verify live account isolation, order ownership, signed support, and download permissions. Do not share PIN codes in chat.
3. Review the product tax classification with a qualified tax professional; Stripe’s current test calculation marks the configured product tax code exempt. Do not change tax settings or codes without an informed decision.
4. Reauthorize Printify read scopes for the existing Natural Studio shop before adding supplier-confirmed physical products. Final product, license, support destination, and customer policy approvals remain launch decisions.
5. Keep PR #4 in draft. Do not merge, publish the digital products, enable customer checkout, alter production, or activate live payments without explicit approval.
