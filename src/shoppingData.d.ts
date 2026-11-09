export type BackupShoppingItem = {
  id: string;
  name: string;
  category: "Wishlist" | "Must Buy" | "Groceries" | "Recurring" | "Buy Later";
  completed: boolean;
  quantity: number;
  price?: number;
  url?: string;
  note?: string;
  priority?: "Low" | "Normal" | "High";
  store?: string;
  shipping?: number;
  estimatedTax?: number;
};
export function parseShoppingItems(serializedItems: string): BackupShoppingItem[];
export function parseShoppingBackup(serializedBackup: string): BackupShoppingItem[];
export function serializeShoppingBackup(items: BackupShoppingItem[]): string;
