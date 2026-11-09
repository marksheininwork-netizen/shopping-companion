# Natural Studio Commerce secure commerce backend

This implementation is intentionally prepared for a dedicated Natural Studio Commerce Supabase Free project. It does not connect to any existing business project.

## Fail-closed release state

- Checkout returns 503 unless CHECKOUT_ENABLED is exactly true and STRIPE_SECRET_KEY begins with sk_test_.
- A product must be active, digital, priced, and assigned a private storage object key before Checkout can create a session. All current product concepts remain drafts.
- The Stripe webhook verifies Stripe-Signature over the raw request body, applies a five-minute timestamp tolerance, and uses an atomic event ledger. It marks an order paid only when session, order, amount, currency, and paid status match.
- Download links require an authenticated customer who owns a paid order. The file must be an active digital product in the private nsc-digital-products bucket. Signed links expire after 60 seconds.
- Public and authenticated users have no direct object-storage policy. Service-role secrets are only used in Edge Functions.
- Orders and support requests are owner-scoped by RLS. Support submissions require a verified account and are limited to five per user per hour.

## Required provisioning

Create a separate Free Plan organization named Natural Studio Commerce Development, then a Free project in it. Do not move or reuse another business's project. Apply the migration before deploying functions.

Configure Edge Function secrets only in the dedicated project:
- STRIPE_SECRET_KEY: restricted test-mode key from the already selected Maria Sheinin test account; it must begin with sk_test_.
- STRIPE_WEBHOOK_SECRET: signing secret for that project's Stripe test webhook endpoint.
- SITE_URL: exact staging origin.
- CHECKOUT_ENABLED: leave unset or false during staging verification; do not set true until the owner approves enabling the test checkout flow.

Supabase supplies SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to deployed Edge Functions. Never put the service-role key, Stripe keys, or webhook secret in Vite variables or GitHub files.

The test-mode webhook endpoint is the stripe-webhook Edge Function. Subscribe only to checkout.session.completed, checkout.session.async_payment_succeeded, and checkout.session.async_payment_failed. Do not create live-mode endpoints.

## Private digital files

The checked-in preview artwork is not the paid package. Upload final product files directly to the private Supabase bucket after project provisioning; do not copy paid assets into public/ or a public GitHub repository. Set each product's download_object_key only after the object is verified in that private bucket. The product remains draft until the owner approves its copy, price, license, and publication.

## Support

support-submit stores a verified customer's message in the dedicated support_requests queue and returns a request ID. It does not send email. Configure and test a support mailbox/notification path and publish the final support contact before customer launch.

## Tests

Run npm test for catalog logic, signature validation, checkout fail-closed rules, and paid-order ownership checks. Run the E2E suite separately for the storefront. Tests that require a live Supabase project, RLS, two-user isolation, private object storage, or Stripe test secrets remain unverified until the dedicated project is provisioned.
