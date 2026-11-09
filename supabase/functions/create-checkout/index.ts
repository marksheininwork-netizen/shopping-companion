import { createClient } from "npm:@supabase/supabase-js@2";
import { checkoutIsEnabled } from "../_shared/stripeSecurity.js";

const encoder = new TextEncoder();
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const origin = request.headers.get("origin");
  const cors = { "Access-Control-Allow-Origin": siteUrl, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
  if (!siteUrl || (origin && origin !== new URL(siteUrl).origin)) return json({ error: "Origin not allowed" }, 403, cors);

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!checkoutIsEnabled(Deno.env.get("CHECKOUT_ENABLED"), stripeSecret)) {
    return json({ error: "Checkout is disabled until test verification and owner approval are complete." }, 503, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = request.headers.get("Authorization") ?? "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!supabaseUrl || !anonKey || !serviceKey || !jwt) return json({ error: "Sign in is required." }, 401, cors);

  const identity = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identityData, error: identityError } = await identity.auth.getUser(jwt);
  const user = identityData.user;
  if (identityError || !user || !user.email_confirmed_at) return json({ error: "A verified customer account is required." }, 401, cors);

  let input: { product_id?: string };
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400, cors); }
  if (!input.product_id || input.product_id.length > 80) return json({ error: "Choose a valid product." }, 400, cors);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: product, error: productError } = await admin.from("products").select("id,name,price_cents,currency,is_download,status,download_object_key").eq("id", input.product_id).eq("status", "active").eq("is_download", true).maybeSingle();
  if (productError || !product || !product.price_cents || !product.download_object_key) return json({ error: "This product is not available for checkout." }, 404, cors);

  const { data: order, error: orderError } = await admin.from("orders").insert({
    user_id: user.id, product_id: product.id, status: "pending",
    amount_cents: product.price_cents, currency: product.currency
  }).select("id").single();
  if (orderError || !order) return json({ error: "Could not start this order." }, 500, cors);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", product.currency);
  form.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
  form.set("line_items[0][price_data][product_data][name]", product.name);
  form.set("client_reference_id", order.id);
  form.set("metadata[order_id]", order.id);
  form.set("metadata[product_id]", product.id);
  form.set("success_url", siteUrl + "/account?session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", siteUrl + "/commerce");

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + stripeSecret, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": "nsc-checkout-" + order.id },
    body: form.toString()
  });
  const session = await stripeResponse.json();
  if (!stripeResponse.ok || typeof session.url !== "string" || typeof session.id !== "string") {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return json({ error: "The test checkout could not be created." }, 502, cors);
  }

  const { error: updateError } = await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
  if (updateError) return json({ error: "The order needs support before checkout can continue." }, 500, cors);
  return json({ checkout_url: session.url }, 200, cors);
});
