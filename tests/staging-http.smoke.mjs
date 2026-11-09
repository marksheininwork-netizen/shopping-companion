import assert from "node:assert/strict";

const baseUrl = (process.env.STAGING_BASE_URL || "https://natural-studio-commerce-staging.pages.dev").replace(/\/$/, "");

async function request(path) {
  return fetch(baseUrl + path, { redirect: "manual", headers: { "User-Agent": "natural-studio-commerce-staging-smoke/1.0" } });
}

const storefront = await request("/commerce");
assert.equal(storefront.status, 200, "staging storefront should return HTTP 200");
const robots = (storefront.headers.get("x-robots-tag") || "").toLowerCase();
assert.match(robots, /noindex/, "staging response should carry an X-Robots-Tag noindex header");
assert.equal(storefront.headers.get("x-content-type-options"), "nosniff");
assert.equal(storefront.headers.get("x-frame-options"), "DENY");
const html = await storefront.text();
assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/i, "commerce HTML should include explicit noindex metadata");

const expectedAccessHost = "flat-art-ac9a.cloudflareaccess.com";
const accessStatuses = [];
for (const path of [
  "/api/v1/customer/me",
  "/api/v1/customer/downloads/00000000-0000-4000-8000-000000000000"
]) {
  const response = await request(path);
  assert.ok([302, 303].includes(response.status), `${path} should redirect unauthenticated requests to Cloudflare Access (received HTTP ${response.status})`);
  accessStatuses.push(response.status);
  const location = response.headers.get("location");
  assert.ok(location, `${path} should have a login redirect`);
  const redirect = new URL(location);
  assert.equal(redirect.hostname, expectedAccessHost, "customer API must be protected by the configured Access team");
  assert.match(redirect.pathname, /\/cdn-cgi\/access\/login\//);
}

console.log(`Staging HTTP smoke passed: storefront=${storefront.status}; account=${accessStatuses[0]} and unpaid-download=${accessStatuses[1]} redirect to Cloudflare Access; noindex/security headers present. No login credentials or request contents were used.`);
