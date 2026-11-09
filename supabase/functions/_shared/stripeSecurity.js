const encoder = new TextEncoder();

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function verifyStripeSignature(rawBody, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(String(timestamp) + "." + rawBody)));
  return signatures.some((candidate) => safeEqual(candidate.toLowerCase(), expected));
}

export function checkoutIsEnabled(flag, stripeSecretKey) {
  return flag === "true" && typeof stripeSecretKey === "string" && stripeSecretKey.startsWith("sk_test_");
}

export function canDownload(order, authenticatedUserId) {
  return Boolean(order && authenticatedUserId && order.user_id === authenticatedUserId && order.status === "paid");
}
