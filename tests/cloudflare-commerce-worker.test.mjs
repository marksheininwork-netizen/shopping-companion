import test from "node:test";
import assert from "node:assert/strict";
import commerceWorker, { checkoutIsEnabled, canCheckoutProduct, customerIdentity, canDownloadOrder, download, verifyStripeSignature, isVerifiedTestCheckoutEvent, addSupportRequest, getSupportRequests, verifiedCheckoutTotals } from "../backend/nsc-commerce-api/index.mjs";

test("test-only checkout requires a restricted test key and a configured signing secret", () => {
  assert.equal(checkoutIsEnabled(undefined, "sk_test_value", "whsec_test_fixture"), false);
  assert.equal(checkoutIsEnabled("true", "sk_live_value", "whsec_test_fixture"), false);
  assert.equal(checkoutIsEnabled("true", "sk_test_value", ""), false);
  assert.equal(checkoutIsEnabled("true", "sk_test_value", "whsec_test_fixture"), true);
  assert.equal(checkoutIsEnabled("true", "rk_test_restricted", "whsec_test_fixture"), true);
  assert.equal(checkoutIsEnabled("true", "rk_live_restricted", "whsec_test_fixture"), false);
});

test("digital checkout requires an approved Stripe Price mapping", () => {
  const base = { is_download: 1, price_cents: 800, stripe_price_id: "price_NSCtest123" };
  assert.equal(canCheckoutProduct(base), true);
  assert.equal(canCheckoutProduct({ ...base, stripe_price_id: null }), false);
  assert.equal(canCheckoutProduct({ ...base, stripe_price_id: "northstar_price" }), false);
  assert.equal(canCheckoutProduct({ ...base, price_cents: null }), false);
  assert.equal(canCheckoutProduct({ ...base, is_download: 0 }), false);
});

test("Stripe fulfillment is bound to the test mode payment, order, and NSC product", () => {
  const order = { id: "order-1", product_id: "nsc-small-rituals", amount_cents: 500, currency: "usd" };
  const event = {
    livemode: false,
    data: { object: {
      mode: "payment",
      client_reference_id: "order-1",
      metadata: { order_id: "order-1", product_id: "nsc-small-rituals" }
    } }
  };
  assert.equal(isVerifiedTestCheckoutEvent(event, order), true);
  assert.equal(isVerifiedTestCheckoutEvent({ ...event, livemode: true }, order), false);
  assert.equal(isVerifiedTestCheckoutEvent({ ...event, livemode: undefined }, order), false);
  assert.equal(isVerifiedTestCheckoutEvent({ ...event, data: { object: { ...event.data.object, mode: "subscription" } } }, order), false);
  assert.equal(isVerifiedTestCheckoutEvent({ ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, product_id: "northstar-product" } } } }, order), false);
  assert.equal(isVerifiedTestCheckoutEvent({ ...event, data: { object: { ...event.data.object, client_reference_id: "other-order" } } }, order), false);
});

test("paid Checkout totals verify the exclusive product subtotal and preserve computed tax", () => {
  const order = { amount_cents: 800, currency: "usd" };
  assert.deepEqual(verifiedCheckoutTotals({ amount_subtotal: 800, amount_total: 870, currency: "usd" }, order), { subtotal: 800, tax: 70, total: 870 });
  assert.deepEqual(verifiedCheckoutTotals({ amount_subtotal: 800, amount_total: 800, currency: "usd" }, order), { subtotal: 800, tax: 0, total: 800 });
  assert.equal(verifiedCheckoutTotals({ amount_subtotal: 600, amount_total: 670, currency: "usd" }, order), null);
  assert.equal(verifiedCheckoutTotals({ amount_subtotal: 800, amount_total: 799, currency: "usd" }, order), null);
  assert.equal(verifiedCheckoutTotals({ amount_subtotal: 800, amount_total: 870, currency: "cad" }, order), null);
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


test("support requests persist to the authenticated customer and remain isolated", async () => {
  const requests = [];
  const env = { DB: {
    prepare(sql) {
      return { bind(...values) {
        if (sql.startsWith("INSERT INTO customers")) {
          return { run: async () => ({ success: true }) };
        }
        if (sql.startsWith("SELECT COUNT(*) AS count FROM support_requests")) {
          const [customerId] = values;
          return { first: async () => ({ count: requests.filter((entry) => entry.customer_id === customerId).length }) };
        }
        if (sql.startsWith("INSERT INTO support_requests")) {
          return { run: async () => {
            const [id, customer_id, category, message] = values;
            requests.push({ id, customer_id, category, message, status: "open", created_at: "2026-11-09 12:00:00" });
            return { success: true };
          } };
        }
        if (sql.startsWith("SELECT id, category, message, status, created_at FROM support_requests WHERE customer_id = ?")) {
          const [customerId] = values;
          return { all: async () => ({ results: requests.filter((entry) => entry.customer_id === customerId).map(({ id, category, message, status, created_at }) => ({ id, category, message, status, created_at })) }) };
        }
        throw new Error("Unexpected D1 query: " + sql);
      } };
    }
  } };
  const owner = { id: "customer-1", email: "one@example.test" };
  const other = { id: "customer-2", email: "two@example.test" };

  const created = await addSupportRequest(
    new Request("https://api.example/api/v1/customer/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "digital-download", message: "  I need help with my file.  " }),
    }),
    env,
    owner,
  );
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.status, "open");

  for (let index = 0; index < 4; index += 1) {
    const response = await addSupportRequest(
      new Request("https://api.example/api/v1/customer/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "other", message: `Follow-up ${index + 1}` }),
      }),
      env,
      owner,
    );
    assert.equal(response.status, 201);
  }

  const rateLimited = await addSupportRequest(
    new Request("https://api.example/api/v1/customer/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "other", message: "One extra request" }),
    }),
    env,
    owner,
  );
  assert.equal(rateLimited.status, 429);

  const ownerRequests = await getSupportRequests(env, owner);
  assert.equal(ownerRequests.length, 5);
  assert.equal(ownerRequests[0].category, "digital-download");
  assert.equal(ownerRequests[0].message, "I need help with my file.");
  assert.ok(ownerRequests.every((entry) => entry.customer_id === undefined));
  assert.deepEqual(await getSupportRequests(env, other), []);
});
