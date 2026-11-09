import test from "node:test";
import assert from "node:assert/strict";
import { calculateBudgetRemaining, calculateOfferTotal } from "../src/shoppingMath.js";
import { parseShoppingBackup, parseShoppingItems, serializeShoppingBackup } from "../src/shoppingData.js";

const legacyItem = { id: "saved-1", name: "Notebook", category: "Wishlist", completed: false, quantity: 2, price: 4.5, url: "https://shop.example/notebook" };

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

test("legacy saved items remain readable after adding optional estimate fields", () => {
  assert.deepEqual(parseShoppingItems(JSON.stringify([legacyItem])), [legacyItem]);
});

test("backup export and import preserve saved items and manual offer estimates", () => {
  const items = [{ ...legacyItem, shipping: 3, estimatedTax: 1.2 }];
  assert.deepEqual(parseShoppingBackup(serializeShoppingBackup(items)), items);
});

test("backup validation rejects malformed records and unsafe product links", () => {
  assert.throws(() => parseShoppingBackup("{"), SyntaxError);
  assert.throws(() => parseShoppingItems(JSON.stringify([{ ...legacyItem, url: "javascript:alert(1)" }])), /Invalid shopping items/);
  assert.throws(() => parseShoppingItems(JSON.stringify([{ ...legacyItem, quantity: 0 }])), /Invalid shopping items/);
});
