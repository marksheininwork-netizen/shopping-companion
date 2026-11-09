import test from "node:test";
import assert from "node:assert/strict";
import { filterGiftIdeas, validatePriceObservation } from "../src/commerceLogic.js";

const ideas = [
  { id: "a", suggestedPrice: 18, interests: ["Plants", "Home"] },
  { id: "b", suggestedPrice: 28, interests: ["Reading"] },
  { id: "c", suggestedPrice: 8, interests: ["Plants"] }
];

test("GiftFinder applies budget and interest filters to concepts", () => {
  assert.deepEqual(filterGiftIdeas(ideas, ["Plants"], 20).map((item) => item.id), ["a", "c"]);
  assert.deepEqual(filterGiftIdeas(ideas, [], 0).map((item) => item.id), ["a", "b", "c"]);
});

test("PriceWatch accepts a dated manual observation and zero price", () => {
  const observation = validatePriceObservation({ name: "Sample item", url: "https://shop.example/item", price: 0, observedAt: "2025-05-01T12:30" });
  assert.equal(observation.source, "manual");
  assert.equal(observation.price, 0);
  assert.equal(observation.url, "https://shop.example/item");
});

test("PriceWatch rejects unsupported schemes, invalid prices, and future dates", () => {
  assert.throws(() => validatePriceObservation({ name: "Sample", url: "http://shop.example/item", price: 2, observedAt: "2025-05-01T12:30" }), /HTTPS/);
  assert.throws(() => validatePriceObservation({ name: "Sample", url: "https://shop.example/item", price: -1, observedAt: "2025-05-01T12:30" }), /valid observed price/);
  assert.throws(() => validatePriceObservation({ name: "Sample", url: "https://shop.example/item", price: 2, observedAt: "2999-01-01T00:00" }), /future/);
});
