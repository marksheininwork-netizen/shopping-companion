import test from "node:test";
import assert from "node:assert/strict";
import commerceWorker, { checkoutIsEnabled, customerIdentity, canDownloadOrder, download, verifyStripeSignature } from "../backend/nsc-commerce-api/index.mjs";

test("test-only checkout stays fail-closed unless explicitly enabled", () => {
  assert.equal(checkoutIsEnabled(undefined, "sk_test_value"), false);
  assert.equal(checkoutIsEnabled("true", "sk_live_value"), false);
  assert.equal(checkoutIsEnabled("true", "sk_test_value"), true);
});

test("Access identity requires a verified-looking email and uses its stable subject or verified email", async () => {
  assert.equal(await customerIdentity(undefined), null);
  assert.deepEqual(await customerIdentity({ getIdentity: async () => ({ email: "Buyer@Example.com" }) }), { id: "buyer@example.com", email: "buyer@example.com" });
  assert.deepEqual(await customerIdentity({ getIdentity: async () => ({ id: "customer-1", email: "Buyer@Example.com" }) }), { id: "customer-1", email: "buyer@example.com" });
});

test("download entitlement requires a paid order owned by the exact signed-in account", () => {
  const base = { status: "paid", customer_id: "customer-1" };
  assert.equal(canDownloadOrder(base, { id: "customer-1" }), true);
  assert.equal(canDownloadOrder({ ...base, status: "pending" }, { id: "customer-1" }), false);
  assert.equal(canDownloadOrder(base, { id: "customer-2" }), false);
  assert.equal(canDownloadOrder(null, { id: "customer-1" }), false);
});

test("customer routes reject requests without Cloudflare Access identity and checkout stays disabled", async () => {
  const env = { CHECKOUT_ENABLED: "false", STRIPE_SECRET_KEY: "sk_test_fixture", DB: { prepare() { throw new Error("database should not be queried"); } } };
  const unauthenticated = await commerceWorker.fetch(new Request("https://api.example/api/v1/customer/orders"), env, {});
  assert.equal(unauthenticated.status, 401);

  const authenticated = await commerceWorker.fetch(new Request("https://api.example/api/v1/customer/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: "draft" }) }), env, { access: { getIdentity: async () => ({ id: "customer-1", email: "buyer@example.com" }) } });
  assert.equal(authenticated.status, 503);
  assert.match((await authenticated.json()).error, /disabled/i);
});

test("secure download route denies unpaid and other customers, and streams only the owner's paid file", async () => {
  const orderId = "123e4567-e89b-12d3-a456-426614174000";
  const orders = new Map([
    [orderId, { status: "paid", customer_id: "customer-1" }],
    ["123e4567-e89b-12d3-a456-426614174001", { status: "pending", customer_id: "customer-1" }]
  ]);
  const bytes = Buffer.from("authorized printable bytes");
  const env = { DB: { prepare(sql) {
    assert.match(sql, /o\.customer_id = \?/);
    assert.match(sql, /o\.status = 'paid'/);
    return { bind(id, customerId) { return { first: async () => {
      const order = orders.get(id);
      if (!order || order.customer_id !== customerId || order.status !== "paid") return null;
      return { ...order, file_name: "room-to-grow.zip", content_type: "application/zip", content_base64: bytes.toString("base64") };
    } }; } };
  } } };

  const owner = await download(new Request("https://api.example/api/v1/customer/downloads/" + orderId), env, { id: "customer-1" }, orderId);
  assert.equal(owner.status, 200);
  assert.equal(owner.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.deepEqual(Buffer.from(await owner.arrayBuffer()), bytes);

  const otherCustomer = await download(new Request("https://api.example/api/v1/customer/downloads/" + orderId), env, { id: "customer-2" }, orderId);
  assert.equal(otherCustomer.status, 403);
  const unpaid = await download(new Request("https://api.example/api/v1/customer/downloads/123e4567-e89b-12d3-a456-426614174001"), env, { id: "customer-1" }, "123e4567-e89b-12d3-a456-426614174001");
  assert.equal(unpaid.status, 403);
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
