
import { useEffect, useState } from "react";
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

  useEffect(() => {
    localStorage.setItem("shopping-items", JSON.stringify(items));
  }, [items]);

  function addItem() {
    const name = newItem.trim();
    if (!name) return;

    setItems((previous) => [
      {
        id: crypto.randomUUID(),
        name,
        category,
        completed: false,
        quantity: 1
      },
      ...previous
    ]);

    setNewItem("");
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

  function deleteItem(id: string) {
    setItems((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  function changeQuantity(id: string, amount: number) {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + amount) }
          : item
      )
    );
  }

  const visibleItems = items.filter(
    (item) =>
      item.category === category &&
      item.name.toLowerCase().includes(search.toLowerCase())
  );

  const remaining = items.filter((item) => !item.completed).length;

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
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>{category}</h2>
                <p>Manage your {category.toLowerCase()} items.</p>
              </div>
              <span className="item-total">
                {visibleItems.length} items
              </span>
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

            <div className="search-box">
              <Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your items..."
                aria-label="Search shopping items"
              />
            </div>

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
