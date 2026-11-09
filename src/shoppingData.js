const categories = ["Wishlist", "Must Buy", "Groceries", "Recurring", "Buy Later"];
const validPriorities = ["Low", "Normal", "High"];

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isShoppingItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  return typeof item.id === "string" && item.id.length > 0 &&
    typeof item.name === "string" && item.name.length <= 500 &&
    categories.includes(item.category) &&
    typeof item.completed === "boolean" &&
    Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100000 &&
    (item.store === undefined || (typeof item.store === "string" && item.store.length <= 100)) &&
    (item.priority === undefined || validPriorities.includes(item.priority)) &&
    (item.price === undefined || isNonNegativeNumber(item.price)) &&
    (item.shipping === undefined || isNonNegativeNumber(item.shipping)) &&
    (item.estimatedTax === undefined || isNonNegativeNumber(item.estimatedTax)) &&
    (item.url === undefined || (typeof item.url === "string" && item.url.startsWith("https://"))) &&
    (item.note === undefined || (typeof item.note === "string" && item.note.length <= 2000));
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length > 10000 || !items.every(isShoppingItem)) {
    throw new Error("Invalid shopping items");
  }
  return items;
}

export function parseShoppingItems(serializedItems) {
  return validateItems(JSON.parse(serializedItems));
}

export function parseShoppingBackup(serializedBackup) {
  const parsed = JSON.parse(serializedBackup);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("items" in parsed)) {
    throw new Error("Invalid backup");
  }
  return validateItems(parsed.items);
}

export function serializeShoppingBackup(items) {
  return JSON.stringify({ version: 1, items: validateItems(items) }, null, 2);
}
