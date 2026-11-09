import test from "node:test";
import assert from "node:assert/strict";
import { calculateBudgetRemaining, calculateOfferTotal } from "../src/shoppingMath.js";

test("offer total includes quantity, shipping, and estimated tax", () => {
  assert.equal(calculateOfferTotal(20, 2, 4, 1.5), 45.5);
});

test("offer total treats omitted optional costs as zero", () => {
  assert.equal(calculateOfferTotal(12, 1), 12);
});

test("budget remaining does not show a negative amount", () => {
  assert.equal(calculateBudgetRemaining(50, 62), 0);
  assert.equal(calculateBudgetRemaining(50, 35), 15);
});
