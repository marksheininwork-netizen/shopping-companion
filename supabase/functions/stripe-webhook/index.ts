import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyStripeSignature } from "../_shared/stripeSecurity.js";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const signature = request.headers.get("Stripe-Signature") ?? "";
  const rawBody = await request.text();
  const valid = await verifyStripeSignature(rawBody, signature, secret);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); } catch { return new Response("Invalid event", { status: 400 }); }
  const eventId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.type === "string" ? event.type : "";
  if (!eventId || !eventType) return new Response("Invalid event", { status: 400 });

  const data = event.data as { object?: Record<string, unknown> } | undefined;
  const session = data?.object;
  const supported = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"];
  if (!supported.includes(eventType)) return new Response(JSON.stringify({ received: true, result: "ignored" }), { headers: { "Content-Type": "application/json" } });
  if (!session || typeof session.id !== "string" || typeof session.client_reference_id !== "string") {
    return new Response("Invalid checkout session", { status: 400 });
  }
  const amount = Number(session.amount_total);
  const currency = typeof session.currency === "string" ? session.currency : "";
  if (!Number.isSafeInteger(amount) || amount < 0 || !currency) return new Response("Invalid amount", { status: 400 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return new Response("Webhook storage is unavailable", { status: 503 });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: result, error } = await admin.rpc("apply_nsc_stripe_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_session_id: session.id,
    p_order_id: session.client_reference_id,
    p_payment_status: typeof session.payment_status === "string" ? session.payment_status : "unpaid",
    p_amount_cents: amount,
    p_currency: currency
  });
  if (error) return new Response("Could not record payment event", { status: 503 });
  if (result === "unmatched") return new Response("Order is not ready; retry webhook", { status: 503 });
  if (result === "mismatch") return new Response("Order verification failed", { status: 400 });
  return new Response(JSON.stringify({ received: true, result }), { headers: { "Content-Type": "application/json" } });
});
