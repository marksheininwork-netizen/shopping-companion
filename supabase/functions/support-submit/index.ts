import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = request.headers.get("Authorization") ?? "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!supabaseUrl || !anonKey || !serviceKey || !jwt) return json({ error: "Sign in to contact support." }, 401);

  const identity = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identityData, error: identityError } = await identity.auth.getUser(jwt);
  const user = identityData.user;
  if (identityError || !user || !user.email_confirmed_at) return json({ error: "A verified customer account is required." }, 401);

  let input: { category?: string; message?: string; website?: string };
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (input.website) return json({ received: true }, 202);
  const categories = ["order", "digital-download", "product-question", "accessibility", "other"];
  const category = input.category ?? "other";
  const message = String(input.message ?? "").trim();
  if (!categories.includes(category) || message.length < 1 || message.length > 4000) return json({ error: "Choose a topic and enter a message up to 4,000 characters." }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin.from("support_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", cutoff);
  if (countError) return json({ error: "Support is temporarily unavailable." }, 503);
  if ((count ?? 0) >= 5) return json({ error: "Please wait before sending another support request." }, 429);

  const { data, error } = await admin.from("support_requests").insert({ user_id: user.id, category, message }).select("id,created_at").single();
  if (error || !data) return json({ error: "Support is temporarily unavailable." }, 503);
  return json({ request_id: data.id, received_at: data.created_at, message: "Your request is saved to the Natural Studio Commerce support queue." }, 201);
});
