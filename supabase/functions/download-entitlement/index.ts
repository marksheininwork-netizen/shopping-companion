import { createClient } from "npm:@supabase/supabase-js@2";
import { canDownload } from "../_shared/stripeSecurity.js";
import { corsForRequest } from "../_shared/cors.js";

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

Deno.serve(async (request) => {
  const cors = corsForRequest(request, Deno.env.get("SITE_URL") ?? "");
  if (!cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
  if (request.method === "OPTIONS") return new Response(null, { headers: cors.headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors.headers);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = request.headers.get("Authorization") ?? "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!supabaseUrl || !anonKey || !serviceKey || !jwt) return json({ error: "Sign in to access purchases." }, 401, cors.headers);

  const identity = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identityData, error: identityError } = await identity.auth.getUser(jwt);
  const user = identityData.user;
  if (identityError || !user) return json({ error: "Sign in to access purchases." }, 401, cors.headers);

  let input: { order_id?: string };
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400, cors.headers); }
  if (!input.order_id || input.order_id.length > 80) return json({ error: "Purchase not found." }, 404, cors.headers);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order } = await admin.from("orders").select("id,user_id,product_id,status").eq("id", input.order_id).eq("user_id", user.id).maybeSingle();
  if (!canDownload(order, user.id)) return json({ error: "A paid purchase is required for this download." }, 403, cors.headers);

  const { data: product } = await admin.from("products").select("id,is_download,status,download_object_key").eq("id", order.product_id).eq("is_download", true).eq("status", "active").maybeSingle();
  if (!product?.download_object_key) return json({ error: "This download is not available." }, 404, cors.headers);

  const { data: signed, error: signedError } = await admin.storage.from("nsc-digital-products").createSignedUrl(product.download_object_key, 60, { download: true });
  if (signedError || !signed?.signedUrl) return json({ error: "The secure download is not available." }, 503, cors.headers);
  return json({ download_url: signed.signedUrl, expires_in_seconds: 60 }, 200, cors.headers);
});
