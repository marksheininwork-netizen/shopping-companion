export function corsForRequest(request, siteUrl) {
  let allowedOrigin;
  try { allowedOrigin = new URL(siteUrl).origin; } catch { return { allowed: false, headers: {} }; }
  const origin = request.headers.get("origin");
  if (!siteUrl || (origin && origin !== allowedOrigin)) return { allowed: false, headers: {} };
  return {
    allowed: true,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  };
}
