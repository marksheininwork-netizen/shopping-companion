const CUSTOMER_PREFIX = "/api/v1/customer/";
const SUPPORT_CATEGORIES = new Set(["order", "digital-download", "product-question", "accessibility", "other"]);

export function checkoutIsEnabled(flag, secret) {
  return flag === "true" && typeof secret === "string" && secret.startsWith("sk_test_");
}

export function customerIdentity(accessContext) {
  if (!accessContext || typeof accessContext.getIdentity !== "function") return null;
  return accessContext.getIdentity().then((identity) => {
    if (!identity || typeof identity.email !== "string" || !identity.email.includes("@")) return null;
    const id = typeof identity.id === "string" ? identity.id : (typeof identity.sub === "string" ? identity.sub : "");
    if (!id || id.length > 255) return null;
    return { id, email: identity.email.trim().toLowerCase() };
  }).catch(() => null);
}

export function canDownloadOrder(order, identity) {
  return Boolean(order && identity && order.status === "paid" && order.customer_id === identity.id);
}

export function verifyStripeSignature(rawBody, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!rawBody || !signatureHeader || !secret) return Promise.resolve(false);
  const pieces = signatureHeader.split(",").map((piece) => piece.split("=", 2));
  const timestamp = Number(pieces.find(([key]) => key === "t")?.[1]);
  const signatures = pieces.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return Promise.resolve(false);
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + rawBody)))
    .then((signature) => {
      const expected = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
      return signatures.some((candidate) => {
        if (candidate.length !== expected.length) return false;
        let diff = 0;
        for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ candidate.toLowerCase().charCodeAt(i);
        return diff === 0;
      });
    })
    .catch(() => false);
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = new Set((env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
  if (!allowed.has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}

async function readJson(request, maxBytes = 16384) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > maxBytes) throw new Error("Request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Request is too large.");
  return JSON.parse(text);
}

function safeDownloadName(value) {
  return String(value || "download").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 100) || "download";
}

async function upsertCustomer(db, identity) {
  await db.prepare("INSERT INTO customers (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, updated_at = datetime('now')")
    .bind(identity.id, identity.email).run();
}

async function listProducts(env) {
  const { results = [] } = await env.DB.prepare("SELECT id, slug, title, description, is_download, price_cents, currency FROM products WHERE status = 'active' ORDER BY created_at DESC LIMIT 100").all();
  return results;
}

async function checkout(request, env, identity) {
  if (!checkoutIsEnabled(env.CHECKOUT_ENABLED, env.STRIPE_SECRET_KEY)) return json({ error: "Checkout is disabled until review and owner approval." }, 503);
  if (!env.DB || !env.STRIPE_SECRET_KEY || !env.PUBLIC_SITE_ORIGIN) return json({ error: "Checkout is not configured." }, 503);
  let input;
  try { input = await readJson(request); } catch { return json({ error: "Invalid request." }, 400); }
  if (typeof input.product_id !== "string" || input.product_id.length > 80) return json({ error: "Choose an available product." }, 400);

  const product = await env.DB.prepare("SELECT id, slug, title, price_cents, currency, is_download FROM products WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(input.product_id).first();
  if (!product || product.is_download !== 1 || !Number.isSafeInteger(product.price_cents) || product.price_cents <= 0) return json({ error: "This product is not available for checkout." }, 404);
  const asset = await env.DB.prepare("SELECT product_id FROM product_assets WHERE product_id = ? LIMIT 1").bind(product.id).first();
  if (!asset) return json({ error: "This download is not configured." }, 404);

  const orderId = crypto.randomUUID();
  await upsertCustomer(env.DB, identity);
  await env.DB.prepare("INSERT INTO orders (id, customer_id, email_snapshot, product_id, amount_cents, currency) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(orderId, identity.id, identity.email, product.id, product.price_cents, product.currency).run();

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", product.currency);
  form.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
  form.set("line_items[0][price_data][product_data][name]", product.title);
  form.set("customer_email", identity.email);
  form.set("client_reference_id", orderId);
  form.set("metadata[order_id]", orderId);
  form.set("metadata[product_id]", product.id);
  form.set("success_url", env.PUBLIC_SITE_ORIGIN + "/commerce?order=" + encodeURIComponent(orderId));
  form.set("cancel_url", env.PUBLIC_SITE_ORIGIN + "/commerce?checkout=cancelled");

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": "nsc-checkout-" + orderId },
    body: form.toString()
  });
  const session = await stripeResponse.json();
  if (!stripeResponse.ok || typeof session.id !== "string" || typeof session.url !== "string") {
    await env.DB.prepare("UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").bind(orderId).run();
    return json({ error: "The test checkout could not be created." }, 502);
  }
  await env.DB.prepare("UPDATE orders SET stripe_checkout_session_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
    .bind(session.id, orderId).run();
  return json({ order_id: orderId, checkout_url: session.url });
}

async function stripeWebhook(request, env) {
  const rawBody = await request.text();
  if (!await verifyStripeSignature(rawBody, request.headers.get("Stripe-Signature") || "", env.STRIPE_WEBHOOK_SECRET || "")) return new Response("Invalid signature", { status: 400 });
  let event;
  try { event = JSON.parse(rawBody); } catch { return new Response("Invalid event", { status: 400 }); }
  if (typeof event.id !== "string" || typeof event.type !== "string") return new Response("Invalid event", { status: 400 });
  const supported = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
  if (!supported.has(event.type)) return json({ received: true, result: "ignored" });
  const session = event.data?.object;
  const orderId = session?.client_reference_id || session?.metadata?.order_id;
  if (!session || typeof session.id !== "string" || typeof orderId !== "string") return new Response("Invalid checkout session", { status: 400 });
  const order = await env.DB.prepare("SELECT id, status, amount_cents, currency, stripe_checkout_session_id FROM orders WHERE id = ? LIMIT 1").bind(orderId).first();
  if (!order) return new Response("Order not ready; retry webhook", { status: 503 });
  if (order.stripe_checkout_session_id !== session.id) return new Response("Order verification failed", { status: 400 });

  const paymentStatus = session.payment_status;
  const eventIsFailed = event.type === "checkout.session.async_payment_failed";
  const isPaid = paymentStatus === "paid" && event.type !== "checkout.session.async_payment_failed";
  if (isPaid && (Number(session.amount_total) !== order.amount_cents || String(session.currency).toLowerCase() !== order.currency)) return new Response("Order verification failed", { status: 400 });

  await env.DB.prepare("INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)").bind(event.id, event.type).run();
  if (eventIsFailed) {
    await env.DB.prepare("UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").bind(order.id).run();
    return json({ received: true, result: "failed" });
  }
  if (!isPaid) return json({ received: true, result: "unpaid" });
  if (order.status === "paid") return json({ received: true, result: "duplicate" });
  if (order.status !== "pending") return new Response("Order state does not allow payment", { status: 409 });
  await env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'pending' AND stripe_checkout_session_id = ?")
    .bind(order.id, session.id).run();
  return json({ received: true, result: "paid" });
}

async function getOrders(env, identity) {
  const { results = [] } = await env.DB.prepare("SELECT id, product_id, status, amount_cents, currency, created_at, paid_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100")
    .bind(identity.id).all();
  return results;
}

async function addSupportRequest(request, env, identity) {
  let input;
  try { input = await readJson(request); } catch { return json({ error: "Invalid request." }, 400); }
  const category = typeof input.category === "string" && SUPPORT_CATEGORIES.has(input.category) ? input.category : "other";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length < 1 || message.length > 4000) return json({ error: "Message must be between 1 and 4000 characters." }, 400);
  await upsertCustomer(env.DB, identity);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM support_requests WHERE customer_id = ? AND created_at >= datetime('now', '-1 hour')").bind(identity.id).first();
  if (Number(recent?.count || 0) >= 5) return json({ error: "Support request limit reached. Try again later." }, 429);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO support_requests (id, customer_id, category, message) VALUES (?, ?, ?, ?)")
    .bind(id, identity.id, category, message).run();
  return json({ id, status: "open" }, 201);
}

async function download(request, env, identity, orderId) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Purchase not found." }, 404);
  const row = await env.DB.prepare("SELECT o.id, o.status, o.customer_id, p.slug, a.file_name, a.content_type, a.content_base64 FROM orders o JOIN products p ON p.id = o.product_id JOIN product_assets a ON a.product_id = p.id WHERE o.id = ? AND o.customer_id = ? AND o.status = 'paid' AND p.status = 'active' AND p.is_download = 1 LIMIT 1")
    .bind(orderId, identity.id).first();
  if (!canDownloadOrder(row, identity)) return json({ error: "A paid purchase is required for this download." }, 403);
  let bytes;
  try { bytes = Uint8Array.from(atob(row.content_base64), (char) => char.charCodeAt(0)); } catch { return json({ error: "The secure download is unavailable." }, 503); }
  const filename = safeDownloadName(row.file_name);
  return new Response(bytes, { headers: { "Content-Type": row.content_type || "application/zip", "Content-Length": String(bytes.byteLength), "Content-Disposition": "attachment; filename=\"" + filename + "\"", "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" } });
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (cors === null) return json({ error: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/api/v1/health") return json({ ok: true, service: "nsc-commerce-api" }, 200, cors);
      if (request.method === "GET" && path === "/api/v1/products") return json({ products: await listProducts(env) }, 200, cors);
      if (request.method === "POST" && path === "/api/v1/webhooks/stripe") return stripeWebhook(request, env);
      if (!path.startsWith(CUSTOMER_PREFIX)) return json({ error: "Not found." }, 404, cors);
      const identity = await customerIdentity(ctx?.access);
      if (!identity) return json({ error: "Verified customer sign-in is required." }, 401, cors);
      if (request.method === "GET" && path === CUSTOMER_PREFIX + "me") {
        await upsertCustomer(env.DB, identity);
        return json({ id: identity.id, email: identity.email }, 200, cors);
      }
      if (request.method === "GET" && path === CUSTOMER_PREFIX + "orders") return json({ orders: await getOrders(env, identity) }, 200, cors);
      if (request.method === "POST" && path === CUSTOMER_PREFIX + "checkout") return checkout(request, env, identity);
      if (request.method === "POST" && path === CUSTOMER_PREFIX + "support") return addSupportRequest(request, env, identity);
      const downloadMatch = path.match(/^\/api\/v1\/customer\/downloads\/([0-9a-f-]{36})$/i);
      if (request.method === "GET" && downloadMatch) return download(request, env, identity, downloadMatch[1]);
      return json({ error: "Not found." }, 404, cors);
    } catch {
      return json({ error: "The request could not be completed." }, 500, cors);
    }
  }
};

export { addSupportRequest, download, listProducts, stripeWebhook };
