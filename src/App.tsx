
import { useEffect, useState } from "react";
import OfferComparison from "./OfferComparison";
import {
  ShoppingCart,
  Heart,
  CalendarClock,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Search,
  ShoppingBag,
  ListTodo
} from "lucide-react";

type Category =
  | "Wishlist"
  | "Must Buy"
  | "Groceries"
  | "Recurring"
  | "Buy Later";

type ShoppingItem = {
  id: string;
  name: string;
  category: Category;
  completed: boolean;
  quantity: number;
  price?: number;
  url?: string;
  note?: string;
  priority?: "Low" | "Normal" | "High";
  store?: string;
};

const categories: Category[] = [
  "Wishlist",
  "Must Buy",
  "Groceries",
  "Recurring",
  "Buy Later"
];

function loadItems(): ShoppingItem[] {
  try {
    const saved = localStorage.getItem("shopping-items");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [items, setItems] = useState<ShoppingItem[]>(loadItems);
  const [category, setCategory] = useState<Category>("Wishlist");
  const [newItem, setNewItem] = useState("");
  const [search, setSearch] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newStore, setNewStore] = useState("");
  const [newPriority, setNewPriority] = useState<"Low" | "Normal" | "High">("Normal");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "price" | "priority">("newest");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    localStorage.setItem("shopping-items", JSON.stringify(items));
  }, [items]);

  async function importItems(file: File) {
    if (file.size > 2_000_000) {
      window.alert("Backup is too large.");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("items" in parsed)) throw Error("Invalid backup");
      const incoming = (parsed as { items: unknown }).items;
      if (!Array.isArray(incoming) || incoming.length > 10000 ||
        !incoming.every((item: unknown) => {
          if (!item || typeof item !== "object") return false;
          const entry = item as Record<string, unknown>;
          return typeof entry.id === "string" && typeof entry.name === "string" &&
            entry.name.length <= 500 && (entry.store === undefined || (typeof entry.store === "string" && entry.store.length <= 100)) && (entry.priority === undefined || ["Low","Normal","High"].includes(entry.priority as string)) && (entry.price === undefined || (typeof entry.price === "number" && Number.isFinite(entry.price) && entry.price >= 0)) && (entry.url === undefined || (typeof entry.url === "string" && entry.url.startsWith("https://"))) && (entry.note === undefined || (typeof entry.note === "string" && entry.note.length <= 2000)) && categories.includes(entry.category as Category) &&
            typeof entry.completed === "boolean" && Number.isSafeInteger(entry.quantity) &&
            (entry.quantity as number) >= 1 && (entry.quantity as number) <= 100000;
        })) throw Error("Invalid shopping items");
      if (window.confirm("Replace your current shopping lists with this backup?")) {
        setItems(incoming as ShoppingItem[]);
      }
    } catch {
      window.alert("This file is not a valid Shopping Companion backup.");
    }
  }

  function exportItems() {
    const blob = new Blob([JSON.stringify({ version: 1, items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shopping-companion-backup.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addItem() {
    const name = newItem.trim();
    if (!name) return;

    setItems((previous) => [
      {
        id: crypto.randomUUID(),
        name,
        category,
        completed: false,
        quantity: 1,
        ...(newPrice.trim() && Number.isFinite(Number(newPrice)) && Number(newPrice) >= 0 ? { price: Number(newPrice) } : {}),
        ...(newUrl.trim().startsWith("https://") ? { url: newUrl.trim() } : {}),
        ...(newNote.trim() ? { note: newNote.trim() } : {}),
        ...(newStore.trim() ? { store: newStore.trim() } : {}),
        priority: newPriority
      },
      ...previous
    ]);

    setNewItem("");
    setNewPrice("");
    setNewUrl("");
    setNewNote("");
    setNewStore("");
    setNewPriority("Normal");
  }

  function clearPurchased() {
    if (window.confirm("Remove all purchased items from this category?")) setItems((previous) => previous.filter((item) => item.category !== category || !item.completed));
  }

  function duplicateItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (item) setItems((previous) => [{ ...item, id: crypto.randomUUID(), completed: false }, ...previous]);
  }

  function toggleItem(id: string) {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  }

  function renameItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const name = window.prompt("Edit item name", item.name)?.trim();
    if (!name || name.length > 500) return;
    setItems((previous) => previous.map((entry) => entry.id === id ? { ...entry, name } : entry));
  }

  function deleteItem(id: string) {
    setItems((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  function changeQuantity(id: string, amount: number) {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.min(100000, Math.max(1, item.quantity + amount)) }
          : item
      )
    );
  }

  const visibleItems = items.filter(
    (item) =>
      item.category === category &&
      item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (statusFilter === "all" || (statusFilter === "completed" ? item.completed : !item.completed))
  ).sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "price" ? (b.price ?? 0) - (a.price ?? 0) : sortBy === "priority" ? (["Low","Normal","High"].indexOf(b.priority ?? "Normal") - ["Low","Normal","High"].indexOf(a.priority ?? "Normal")) : 0);

  const remaining = items.filter((item) => !item.completed).length;
  const estimatedTotal = items.filter((item) => !item.completed).reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const categoryTotal = visibleItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <ShoppingBag size={30} />
          <span>Shopping Companion</span>
        </div>
        <div className="header-right">
          <span className="status">Your shopping, organized.</span>
        </div>
      </header>

      <OfferComparison />
      <div className="layout">
        <aside className="sidebar">
          <h3>My Shopping</h3>

          {categories.map((name) => (
            <button
              key={name}
              className={`nav-item ${category === name ? "active" : ""}`}
              onClick={() => setCategory(name)}
            >
              {name === "Wishlist" && <Heart size={19} />}
              {name === "Must Buy" && <ListTodo size={19} />}
              {name === "Groceries" && <ShoppingCart size={19} />}
              {name === "Recurring" && <CalendarClock size={19} />}
              {name === "Buy Later" && <ShoppingBag size={19} />}
              <span>{name}</span>
              <span className="count">
                {items.filter((item) => item.category === name).length}
              </span>
            </button>
          ))}
        </aside>

        <main className="main">
          <section className="welcome">
            <div>
              <p className="eyebrow">MY SHOPPING SPACE</p>
              <h1>Make shopping simple.</h1>
              <p>
                Save what you love, organize what you need,
                and keep everything in one place.
              </p>
            </div>
            <div className="summary">
              <strong>{remaining}</strong>
              <span>Items remaining</span>
              <strong>${estimatedTotal.toFixed(2)}</strong>
              <span>Estimated unpurchased total</span>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Your data</h2>
                <p>Keep a personal backup of your shopping lists.</p>
              </div>
              <button type="button" className="primary-button" onClick={exportItems}>
                Export backup
              </button>
              <label className="primary-button" style={{ cursor: "pointer" }}>
                Import backup
                <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importItems(file);
                  event.currentTarget.value = "";
                }} />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>{category}</h2>
                <p>Manage your {category.toLowerCase()} items.</p>
              </div>
              <span className="item-total">{visibleItems.length} items</span>
              <button type="button" className="primary-button" onClick={clearPurchased} disabled={!items.some((item) => item.category === category && item.completed)}>Clear purchased</button>
            </div>

            <div className="add-form">
              <input
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addItem();
                }}
                placeholder={`Add to ${category}...`}
                aria-label="New shopping item"
              />
              <button onClick={addItem} className="primary-button">
                <Plus size={19} />
                Add Item
              </button>
            </div>

            <div className="add-form">
              <input type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Estimated unit price ($)" aria-label="Estimated unit price" />
              <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://product-link" aria-label="Product link" />
              <input value={newNote} maxLength={2000} onChange={(e) => setNewNote(e.target.value)} placeholder="Optional note" aria-label="Shopping item note" />
              <input value={newStore} maxLength={100} onChange={(e) => setNewStore(e.target.value)} placeholder="Store" aria-label="Preferred store" />
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as typeof newPriority)} aria-label="Item priority"><option>Low</option><option>Normal</option><option>High</option></select>
            </div>
            <div className="search-box">
              <Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your items..."
                aria-label="Search shopping items"
              />
            </div>

            <div className="add-form" role="group" aria-label="Filter shopping items by status">
              {(["all", "active", "completed"] as const).map((status) => (
                <button key={status} type="button" className="primary-button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} style={{ opacity: statusFilter === status ? 1 : 0.55 }}>
                  {status === "all" ? "All" : status === "active" ? "To buy" : "Purchased"}
                </button>
              ))}
            </div>

            <div className="add-form"><label htmlFor="shopping-sort">Sort by</label><select id="shopping-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}><option value="newest">Newest first</option><option value="name">Name</option><option value="price">Highest price</option><option value="priority">Highest priority</option></select><span aria-live="polite">Visible items total: ${categoryTotal.toFixed(2)}</span></div>
            <div className="item-list">
              {visibleItems.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={42} />
                  <h3>No items yet</h3>
                  <p>Add your first item to get started.</p>
                </div>
              ) : (
                visibleItems.map((item) => (
                  <div className="shopping-item" key={item.id}>
                    <button
                      className="icon-button"
                      onClick={() => toggleItem(item.id)}
                      aria-label={`Toggle ${item.name}`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="checked" size={24} />
                      ) : (
                        <Circle size={24} />
                      )}
                    </button>

                    <span
                      className={`item-name ${
                        item.completed ? "completed" : ""
                      }`}
                    >
                      {item.name}
                    </span>

                    <button type="button" className="icon-button" onClick={() => renameItem(item.id)} aria-label={`Rename ${item.name}`} title="Edit name">Edit</button>
                    <button type="button" className="icon-button" onClick={() => duplicateItem(item.id)} aria-label={`Duplicate ${item.name}`}>Copy</button>
                    {item.priority === "High" && <strong title="High priority">High</strong>}
                    {item.store && <span title="Preferred store">{item.store}</span>}
                    {item.price !== undefined && <span title="Unit price">${(item.price * item.quantity).toFixed(2)}</span>}
                    {item.url?.startsWith("https://") && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open product link for ${item.name}`}>Product</a>}
                    {item.note && <span title={item.note} aria-label={`Note: ${item.note}`}>Note</span>}
                    <div className="quantity">
                      <button
                        onClick={() => changeQuantity(item.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(item.id, 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="icon-button delete-button"
                      onClick={() => deleteItem(item.id)}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 size={19} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
