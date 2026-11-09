import test from "node:test";
import assert from "node:assert/strict";
import { checkoutIsEnabled, customerIdentity, canDownloadOrder, verifyStripeSignature } from "../backend/nsc-commerce-api/index.mjs";

test("test-only checkout stays fail-closed unless explicitly enabled", () => {
  assert.equal(checkoutIsEnabled(undefined, "sk_test_value"), false);
  assert.equal(checkoutIsEnabled("true", "sk_live_value"), false);
  assert.equal(checkoutIsEnabled("true", "sk_test_value"), true);
});

test("Access identity requires a verified-looking email and stable subject", async () => {
  assert.equal(await customerIdentity(undefined), null);
  assert.equal(await customerIdentity({ getIdentity: async () => ({ id: "customer-1", email: "buyer@example.com" }) }), null);
  assert.deepEqual(await customerIdentity({ getIdentity: async () => ({ id: "customer-1", email: "Buyer@Example.com" }) }), { id: "customer-1", email: "buyer@example.com" });
});

test("download entitlement requires a paid order owned by the exact signed-in account", () => {
  const base = { status: "paid", customer_id: "customer-1" };
  assert.equal(canDownloadOrder(base, { id: "customer-1" }), true);
  assert.equal(canDownloadOrder({ ...base, status: "pending" }, { id: "customer-1" }), false);
  assert.equal(canDownloadOrder(base, { id: "customer-2" }), false);
  assert.equal(canDownloadOrder(null, { id: "customer-1" }), false);
});

test("Stripe webhook signature accepts fresh signed bodies and rejects tampering or stale signatures", async () => {
  const secret = "whsec_nsc_test_fixture";
  const body = JSON.stringify({ id: "evt_fixture", type: "checkout.session.completed" });
  const timestamp = 1_800_000_000;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + body))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  assert.equal(await verifyStripeSignature(body, "t=" + timestamp + ",v1=" + signature, secret, timestamp), true);
  assert.equal(await verifyStripeSignature(body + "!", "t=" + timestamp + ",v1=" + signature, secret, timestamp), false);
  assert.equal(await verifyStripeSignature(body, "t=" + timestamp + ",v1=" + signature, secret, timestamp + 301), false);
});
