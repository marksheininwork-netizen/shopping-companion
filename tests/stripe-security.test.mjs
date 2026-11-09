import test from "node:test";
import assert from "node:assert/strict";
import { canDownload, checkoutIsEnabled, verifyStripeSignature } from "../supabase/functions/_shared/stripeSecurity.js";

const secret = "whsec_test_only_for_unit_tests";
async function signatureFor(body, timestamp, key) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(String(timestamp) + "." + body));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

test("Stripe webhook signature accepts valid, fresh signatures", async () => {
  const body = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const now = 1_800_000_000;
  const signature = await signatureFor(body, now, secret);
  assert.equal(await verifyStripeSignature(body, "t=" + now + ",v1=" + signature, secret, now), true);
});

test("Stripe webhook rejects altered body, bad signatures, and stale timestamps", async () => {
  const body = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const now = 1_800_000_000;
  const signature = await signatureFor(body, now, secret);
  assert.equal(await verifyStripeSignature(body + " ", "t=" + now + ",v1=" + signature, secret, now), false);
  assert.equal(await verifyStripeSignature(body, "t=" + now + ",v1=" + "0".repeat(64), secret, now), false);
  assert.equal(await verifyStripeSignature(body, "t=" + (now - 600) + ",v1=" + signature, secret, now), false);
  assert.equal(await verifyStripeSignature(body, "v1=" + signature, secret, now), false);
});

test("hosted checkout is fail-closed and accepts test keys only", () => {
  assert.equal(checkoutIsEnabled(undefined, "sk_test_example"), false);
  assert.equal(checkoutIsEnabled("true", "sk_live_example"), false);
  assert.equal(checkoutIsEnabled("true", "sk_test_example"), true);
});

test("download requires a paid order owned by the authenticated customer", () => {
  const paid = { user_id: "customer-a", status: "paid" };
  assert.equal(canDownload(paid, "customer-a"), true);
  assert.equal(canDownload({ ...paid, status: "pending" }, "customer-a"), false);
  assert.equal(canDownload({ ...paid, status: "failed" }, "customer-a"), false);
  assert.equal(canDownload(paid, "customer-b"), false);
  assert.equal(canDownload(paid, ""), false);
  assert.equal(canDownload(null, "customer-a"), false);
});
