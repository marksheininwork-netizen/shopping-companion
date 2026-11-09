export function calculateOfferTotal(price = 0, quantity = 1, shipping = 0, estimatedTax = 0) {
  return price * quantity + shipping + estimatedTax;
}

export function calculateBudgetRemaining(budget, estimatedSpend) {
  return Math.max(0, budget - estimatedSpend);
}
