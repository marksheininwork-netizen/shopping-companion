export function calculateOfferTotal(price = 0, quantity = 1, shipping = 0, estimatedTax = 0) {
  return price * quantity + shipping + estimatedTax;
}

export function calculateBudgetRemaining(budget, estimatedSpend) {
  return Math.max(0, budget - estimatedSpend);
}

export function readShoppingBudget(storedValue) {
  if (storedValue === null || storedValue.trim() === "") return "";
  const value = Number(storedValue);
  return Number.isFinite(value) && value >= 0 ? String(value) : "";
}
