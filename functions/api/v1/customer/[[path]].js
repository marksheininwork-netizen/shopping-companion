import commerceWorker from "../../../../backend/nsc-commerce-api/index.mjs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
let cachedJwks;
let cachedJwksAt = 0;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), (char) => char.charCodeAt(0));
}

function decodeJsonSegment(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function fetchJwks(teamDomain, fetchImpl = fetch) {
  const now = Date.now();
  if (cachedJwks && now - cachedJwksAt < 300_000) return cachedJwks;
  const origin = new URL(teamDomain);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".cloudflareaccess.com")) throw new Error("Invalid Access issuer.");
  const response = await fetchImpl(new URL("/cdn-cgi/access/certs", origin));
  if (!response.ok) throw new Error("Access signing keys are unavailable.");
  const keyset = await response.json();
  if (!Array.isArray(keyset.keys)) throw new Error("Invalid Access signing keys.");
  cachedJwks = keyset;
  cachedJwksAt = now;
  return keyset;
}

export async function verifyPagesAccessToken(token, env, fetchImpl = fetch) {
  if (typeof token !== "string" || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUDIENCE) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header;
  let payload;
  try {
    header = decodeJsonSegment(parts[0]);
    payload = decodeJsonSegment(parts[1]);
  } catch { return null; }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const expectedIssuer = new URL(env.ACCESS_TEAM_DOMAIN).origin;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== expectedIssuer || !audiences.includes(env.ACCESS_AUDIENCE) || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds || (Number.isFinite(payload.nbf) && payload.nbf > nowSeconds + 30)) return null;
  if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;

  try {
    const keyset = await fetchJwks(expectedIssuer, fetchImpl);
    const jwk = keyset.keys.find((key) => key.kid === header.kid && key.kty === "RSA" && key.use !== "enc");
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const signature = decodeBase64Url(parts[2]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signed);
    if (!valid) return null;
    const email = payload.email.trim().toLowerCase();
    const id = typeof payload.sub === "string" && payload.sub.length > 0 && payload.sub.length <= 255 ? payload.sub : email;
    return { id, email };
  } catch { return null; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const identity = await verifyPagesAccessToken(request.headers.get("Cf-Access-Jwt-Assertion"), env);
  if (!identity) {
    return new Response(JSON.stringify({ error: "Verified customer sign-in is required." }), { status: 401, headers: JSON_HEADERS });
  }
  try {
    return await commerceWorker.fetch(request, env, { access: { getIdentity: async () => identity } });
  } catch {
    return new Response(JSON.stringify({ error: "The request could not be completed." }), { status: 500, headers: JSON_HEADERS });
  }
}

export { fetchJwks };
