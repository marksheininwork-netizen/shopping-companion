export function filterGiftIdeas(products, interests, budget) {
  const limit = Number(budget);
  return products.filter((product) => {
    const hasBudget = String(budget).trim() !== "";
    const budgetMatch = !hasBudget || (Number.isFinite(limit) && limit >= 0 && product.suggestedPrice <= limit);
    const interestMatch = interests.length === 0 || interests.some((interest) => product.interests.includes(interest));
    return budgetMatch && interestMatch;
  });
}

export function validatePriceObservation({ name, url, price, observedAt }) {
  const trimmedName = String(name ?? "").trim();
  const numericPrice = Number(price);
  const date = new Date(observedAt);
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new Error("Enter a valid product URL."); }
  if (!trimmedName) throw new Error("Enter a product name.");
  if (parsedUrl.protocol !== "https:") throw new Error("Use a secure HTTPS product URL.");
  if (!Number.isFinite(numericPrice) || numericPrice < 0) throw new Error("Enter a valid observed price.");
  if (!observedAt || Number.isNaN(date.valueOf())) throw new Error("Enter when you observed this price.");
  if (date.valueOf() > Date.now() + 60000) throw new Error("Observation time cannot be in the future.");
  return { id: crypto.randomUUID(), name: trimmedName.slice(0, 160), url: parsedUrl.href, price: numericPrice, observedAt: date.toISOString(), source: "manual" };
}
