# Natural Studio Commerce secure commerce backend

Natural Studio Commerce staging uses a dedicated Cloudflare Pages project, Cloudflare Worker API, and isolated D1 database. It does not connect to or reuse another business's database. Current release state is staging-only; customer checkout is disabled.

## Fail-closed state and data ownership

- Customer API requests are gated by the staging Cloudflare Access application. The Pages Function separately validates `Cf-Access-Jwt-Assertion` against Cloudflare Access JWKS using RS256, issuer, audience, expiry, not-before, and email checks.
- The verified Access subject is the account key; every order, support request, and download query is scoped to that identity. Invalid or missing assertions return 401 from the function.
- The dedicated D1 database is `natural-studio-commerce-development` (`277ba940-6c62-4489-b29e-64dd7104b9d5`). Its customer, order, support, product, asset, and Stripe event tables belong only to Natural Studio Commerce.
- Current customer authentication uses email PIN through Access. That gate is appropriate for staging/admin, but Access is not the intended consumer login experience. No seeded NSC test identity or PIN-free test path is configured.

## Hosted Checkout and fulfillment

- Checkout is off: `CHECKOUT_ENABLED=false`. The API requires this to be explicitly enabled and accepts only a test-mode `sk_test_` key.
- A product must be active, digital, priced, and backed by a private stored asset before checkout can create a session.
- Stripe webhooks are verified against the raw request body and five-minute timestamp tolerance. Fulfillment checks paid status, session/order/product association, exact amount and currency, and ownership before marking an order paid. Event IDs are stored for idempotent handling.
- Downloads require an authenticated owner and a paid order for an active digital product. No direct public asset URL is provided.
- Product archive content is currently stored as base64 in isolated D1 for small staging files. This is not the long-term storage design. Use a private object store with short-lived, owner-authorized delivery before increasing package size or traffic; do not enable a paid storage service without approval.
- Proposed Stripe test webhook destination: `https://nsc-commerce-api-staging.marksheininwork.workers.dev/api/v1/webhooks/stripe`. This endpoint has not received a live Stripe test event.
- Required encrypted Worker secret names, once an isolated NSC test price is approved: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The first must begin `sk_test_`; the second is the test webhook signing secret. Keep `CHECKOUT_ENABLED=false` until owner approval. Never expose any secret in frontend code, source control, or logs.

## Support

Authenticated support requests are validated, rate-limited, and stored in D1 by the authenticated customer. The API does not send email. A monitored support inbox, response-time promise, and final public support contact require owner setup and review. Signed-in support submission has not yet been verified against a real PIN-authenticated customer.

## Public customer identity design

Keep Cloudflare Access on staging and operator-only/admin routes. For future public customers, select a customer OIDC provider and implement Authorization Code with PKCE. Validate provider issuer, signature, audience, state, nonce, expiry, and verified-email claim. Key accounts by issuer plus immutable subject, not email alone. Create random short-lived opaque sessions; store only a cryptographic hash in D1 and deliver the token as a Secure, HttpOnly, SameSite cookie. Rotate and revoke sessions, require CSRF protection for mutations, apply login and action rate limits, and enforce owner-scoped D1 access on every query. Decide provider, email delivery/recovery, retention, and legal consent before public launch.

## Tests and current verification

- Automated tests cover webhook signatures and replay tolerance, fail-closed checkout behavior, event idempotency, order ownership, paid-download entitlement, D1 API behavior, and support request persistence, owner-scoped listing, and rate limiting with test fixtures.
- GitHub Actions build/type checks, commerce/security regression tests, desktop/mobile Playwright preview tests, and the staging HTTP smoke check passed on the reviewed code/test commit. Latest completed verification is against code/test commit `8b1fd290de36a04c1521e95bdedf3611347b11a9`: Build and validate #78 (`42678215994`) and Commerce tools tests #54 (`42678216514`) both succeeded, including Access JWT verifier and account-scoped support persistence/rate-limit tests.
- Live staging smoke confirms the storefront returns 200 and that unauthenticated customer API requests redirect to Cloudflare Access. No live Access PIN was completed; live cross-user data isolation, support persistence, order access, and paid/unpaid download flows are not verified.
- No Stripe secret or webhook secret is configured, no NSC Stripe price is mapped, and checkout remains disabled. No live Stripe webhook test was run.
