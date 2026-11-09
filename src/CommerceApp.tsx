import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, CircleDollarSign, Gift, Heart, Leaf, Menu, Search, ShieldCheck, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { filterGiftIdeas, validatePriceObservation } from "./commerceLogic.js";

type Product = {
  id: string;
  name: string;
  division: string;
  category: string;
  collection: string;
  description: string;
  details: string;
  suggestedPrice: number;
  interests: string[];
  image: string;
  imageAlt: string;
};

type Observation = { id: string; name: string; url: string; price: number; observedAt: string; source: "manual" };
type AccountProfile = { id: string; email: string };
type AccountOrder = { id: string; product_id: string; status: string; amount_cents: number; currency: string; created_at: string; paid_at: string | null };
type SupportRequest = { id: string; category: string; message: string; status: string; created_at: string };
const interests = ["Plant lover", "Slow living", "Reading", "Home rituals", "Creative"];

const products: Product[] = [
  { id: "tee", name: "Small Rituals botanical tee", division: "Natural Studio", category: "Apparel", collection: "Small Rituals", description: "A quiet botanical graphic for everyday wear.", details: "Original Natural Studio artwork, prepared as a print-on-demand concept. Garment blank, fabric, print area, size range, supplier cost, shipping, and production timing still need confirmation.", suggestedPrice: 28, interests: ["Plant lover", "Slow living", "Creative"], image: "/mockups/small-rituals-collection.svg", imageAlt: "Original vector concept board showing several Small Rituals product ideas" },
  { id: "mug", name: "Room to Grow mug concept", division: "Natural Studio", category: "Mugs", collection: "Small Rituals", description: "The Small Rituals sprig, adapted for a daily cup.", details: "Original artwork concept for a future print-on-demand mug. Capacity, ceramic type, print area, dishwasher guidance, supplier cost, and shipping are not verified.", suggestedPrice: 18, interests: ["Plant lover", "Home rituals", "Slow living"], image: "/mockups/small-rituals-collection.svg", imageAlt: "Original vector concept board showing a mug with a botanical sprig" },
  { id: "tote", name: "Small Rituals carryall concept", division: "Natural Studio", category: "Accessories", collection: "Small Rituals", description: "A reusable carryall concept with the original sprig.", details: "Original artwork concept for a future tote. Fabric, dimensions, handle construction, print area, supplier cost, and shipping require verification.", suggestedPrice: 24, interests: ["Plant lover", "Creative", "Reading"], image: "/mockups/small-rituals-collection.svg", imageAlt: "Original vector concept board showing a tote with botanical artwork" },
  { id: "notebook", name: "Room to Grow notebook concept", division: "Natural Studio", category: "Stationery", collection: "Small Rituals", description: "A calm cover concept for notes and small plans.", details: "Original cover artwork concept. Paper, page count, binding, dimensions, supplier cost, and shipping are not verified.", suggestedPrice: 16, interests: ["Reading", "Home rituals", "Creative"], image: "/mockups/small-rituals-collection.svg", imageAlt: "Original vector concept board showing a notebook with botanical artwork" },
  { id: "print", name: "Small rituals printable artwork", division: "Digital Design Shop", category: "Digital artwork", collection: "Small Rituals", description: "Original botanical line art in a print-at-home SVG file.", details: "Review package prepared locally with editable SVG and PDF exports. License remains a draft; seller and rights-holder identity, final terms, and secure customer delivery need review before sale.", suggestedPrice: 8, interests: ["Plant lover", "Slow living", "Home rituals", "Creative"], image: "/mockups/digital-print-concept.svg", imageAlt: "Framed concept preview of the original Small Rituals printable design" },
  { id: "time-print", name: "Some Things Take Time printable", division: "Digital Design Shop", category: "Digital artwork", collection: "Small Rituals", description: "An original botanical reminder to grow at your own pace, drafted as an A4 vector print.", details: "Review package prepared locally with A4 SVG and PDF exports. The license is a draft; verified rights-holder details, final terms, and secure customer delivery still need review before sale.", suggestedPrice: 6, interests: ["Plant lover", "Slow living", "Home rituals"], image: "/mockups/some-things-take-time.svg", imageAlt: "Framed botanical poster concept reading Some Things take time" },
  { id: "home-print", name: "Small Rituals wall print concept", division: "Natural Studio", category: "Home goods", collection: "Small Rituals", description: "A paper print concept from the same original botanical series.", details: "Artwork preview only. Paper stock, print dimensions, framing, production quality, supplier cost, and shipping are not verified.", suggestedPrice: 22, interests: ["Home rituals", "Plant lover", "Reading"], image: "/mockups/digital-print-concept.svg", imageAlt: "Framed concept preview for a future botanical wall print" }
];

const collections = ["All concepts", "Apparel", "Mugs", "Accessories", "Stationery", "Digital artwork", "Home goods"];

function useLocalState<T>(key: string, fallback: T): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) as T : fallback;
    } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

function ProductCard({ product, saved, onSave, onDetails, onAdd }: { product: Product; saved: boolean; onSave: () => void; onDetails: () => void; onAdd: () => void }) {
  return <article className="product-card">
    <div className="product-art"><img src={product.image} alt={product.imageAlt} loading="lazy" /><button className={"save-button" + (saved ? " is-saved" : "")} aria-label={saved ? "Remove from saved ideas" : "Save idea"} aria-pressed={saved} onClick={onSave}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button><span className="draft-chip">Concept</span></div>
    <div className="product-copy"><p className="eyebrow">{product.division} · {product.category}</p><h3>{product.name}</h3><p>{product.description}</p><div className="price-line"><span>Draft price suggestion</span><strong>$ {product.suggestedPrice}.00</strong></div><div className="product-actions"><button className="text-button" onClick={onDetails}>Details <ArrowRight size={15} /></button><button className="secondary-button" onClick={onAdd}>Add to research cart</button></div></div>
  </article>;
}

export default function CommerceApp() {
  const [category, setCategory] = useState("All concepts");
  const [search, setSearch] = useState("");
  const [savedIdeas, setSavedIdeas] = useLocalState<string[]>("nsc-saved-ideas", []);
  const [cart, setCart] = useLocalState<string[]>("nsc-research-cart", []);
  const [observations, setObservations] = useLocalState<Observation[]>("nsc-manual-price-observations", []);
  const [contactDraft, setContactDraft] = useLocalState("nsc-contact-draft", "");
  const [contactCategory, setContactCategory] = useLocalState("nsc-contact-category", "other");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [giftBudget, setGiftBudget] = useState("30");
  const [giftInterests, setGiftInterests] = useState<string[]>([]);
  const [giftSaved, setGiftSaved] = useLocalState<string[]>("nsc-saved-gift-ideas", []);
  const [watchName, setWatchName] = useState("");
  const [watchUrl, setWatchUrl] = useState("");
  const [watchPrice, setWatchPrice] = useState("");
  const [watchDate, setWatchDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [watchError, setWatchError] = useState("");
  const [notice, setNotice] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactStatus, setContactStatus] = useState("");
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [accountOrders, setAccountOrders] = useState<AccountOrder[]>([]);
  const [accountSupport, setAccountSupport] = useState<SupportRequest[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleProducts = products.filter((product) => (category === "All concepts" || product.category === category) && (product.name.toLowerCase().includes(search.trim().toLowerCase()) || product.description.toLowerCase().includes(search.trim().toLowerCase())));
  const gifts = useMemo(() => filterGiftIdeas(products, giftInterests, giftBudget), [giftInterests, giftBudget]);
  const cartProducts = cart.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  const draftCartTotal = cartProducts.reduce((sum, product) => sum + product.suggestedPrice, 0);
  const orderedObservations = [...observations].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  function toggleSaved(id: string) {
    setSavedIdeas((previous) => previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]);
  }

  function addToCart(id: string) {
    setCart((previous) => previous.includes(id) ? previous : [...previous, id]);
    setNotice("Concept added to your research cart. It is not available for purchase.");
    window.setTimeout(() => setNotice(""), 3500);
  }

  function toggleGiftInterest(value: string) {
    setGiftInterests((previous) => previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]);
  }

  function saveGift(id: string) {
    setGiftSaved((previous) => previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]);
  }

  function addObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWatchError("");
    try {
      const entry = validatePriceObservation({ name: watchName, url: watchUrl, price: watchPrice, observedAt: watchDate });
      setObservations((previous) => [...previous, entry]);
      setWatchPrice("");
      setNotice("Manual observation saved in this browser.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : "Check the observation details.");
    }
  }

  async function loadCustomerAccount() {
    setAccountLoading(true);
    setAccountError("");
    try {
      const [profileResponse, ordersResponse, supportResponse] = await Promise.all([
        fetch("/api/v1/customer/me", { credentials: "same-origin" }),
        fetch("/api/v1/customer/orders", { credentials: "same-origin" }),
        fetch("/api/v1/customer/support", { credentials: "same-origin" })
      ]);
      if (![profileResponse, ordersResponse, supportResponse].every((response) => response.ok)) throw new Error("Sign in again to load your account.");
      const [profile, orders, support] = await Promise.all([profileResponse.json(), ordersResponse.json(), supportResponse.json()]);
      setAccountProfile(profile as AccountProfile);
      setAccountOrders(Array.isArray(orders.orders) ? orders.orders as AccountOrder[] : []);
      setAccountSupport(Array.isArray(support.requests) ? support.requests as SupportRequest[] : []);
    } catch {
      setAccountError("Your account data could not be loaded. Sign in again or try refreshing.");
      setAccountProfile(null);
    } finally {
      setAccountLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("account") === "connected") {
      void loadCustomerAccount();
      window.history.replaceState(null, "", window.location.pathname + "#account");
    }
  }, []);

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactStatus("");
    if (!accountProfile) {
      setContactSubmitted(true);
      setContactStatus("Draft saved on this device. Sign in to submit a private support request.");
      return;
    }
    setContactSaving(true);
    try {
      const response = await fetch("/api/v1/customer/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: contactCategory, message: contactDraft })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your request could not be saved.");
      setContactSubmitted(true);
      setContactStatus("Support request saved to your account.");
      const supportResponse = await fetch("/api/v1/customer/support", { credentials: "same-origin" });
      if (supportResponse.ok) {
        const support = await supportResponse.json();
        setAccountSupport(Array.isArray(support.requests) ? support.requests as SupportRequest[] : []);
      }
    } catch (error) {
      setContactStatus(error instanceof Error ? error.message : "Your request could not be saved.");
    } finally {
      setContactSaving(false);
    }
  }

  return <div className="commerce-app">
    {notice && <div className="toast" role="status">{notice}</div>}
    <div className="top-note"><Leaf size={15} /> Original designs and helpful tools, growing thoughtfully <span>Every product shown is a draft concept</span></div>
    <header className="site-header">
      <a className="wordmark" href="#home" aria-label="Natural Studio Commerce home"><span className="brand-mark"><Leaf size={23} /></span><span>natural studio<small>COMMERCE</small></span></a>
      <button className="mobile-menu" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
      <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label="Main navigation">
        <a href="#collections" onClick={() => setMenuOpen(false)}>Shop concepts</a><a href="#digital-designs" onClick={() => setMenuOpen(false)}>Digital design</a><a href="#gift-finder" onClick={() => setMenuOpen(false)}>GiftFinder</a><a href="#price-watch" onClick={() => setMenuOpen(false)}>PriceWatch</a><a href="#about" onClick={() => setMenuOpen(false)}>Our story</a>
      </nav>
      <div className="header-actions"><a className="account-link" href="#account">My space</a><button className="cart-button" onClick={() => setCartOpen(true)} aria-label={"Open research cart, " + cart.length + " items"}><ShoppingBag size={18} /><span>Cart</span>{cart.length > 0 && <b>{cart.length}</b>}</button></div>
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-copy"><p className="eyebrow">THOUGHTFUL FINDS · ORIGINAL IDEAS</p><h1>A little more<br /><em>meaning</em> in the everyday.</h1><p className="hero-intro">Natural Studio Commerce brings original design ideas and practical shopping tools together in one calm corner of the internet.</p><div className="hero-actions"><a className="primary-button" href="#collections">Explore the collection <ArrowRight size={17} /></a><a className="plain-link" href="#gift-finder">Find a thoughtful gift</a></div><div className="hero-trust"><span><Check size={15} /> Original design concepts</span><span><Check size={15} /> Prices marked as drafts</span></div></div>
        <div className="hero-image"><img src="/mockups/small-rituals-collection.svg" alt="Illustrated concept board showing original Small Rituals apparel, mug, tote, and stationery" /><div className="image-caption"><span>THE SMALL RITUALS COLLECTION</span><span>Concept artwork · not for sale</span></div></div>
        <span className="hero-leaf leaf-one"><Leaf size={48} /></span><span className="hero-leaf leaf-two"><Leaf size={28} /></span>
      </section>

      <section className="promise-strip" aria-label="Store principles"><div><span>01</span><p><strong>Made with intention</strong><small>Original artwork, clear product details.</small></p></div><div><span>02</span><p><strong>Thoughtful discovery</strong><small>Tools to help you choose with care.</small></p></div><div><span>03</span><p><strong>Honest by design</strong><small>Draft details stay clearly marked.</small></p></div></section>

      <section className="section collection-section" id="collections">
        <div className="section-heading"><div><p className="eyebrow">THE NATURAL STUDIO COLLECTIONS</p><h2>Ideas in the making</h2><p>Explore an original collection concept across everyday objects and digital design.</p></div><span className="section-mark">01 / 04</span></div>
        <div className="collection-toolbar"><div className="category-filters" role="group" aria-label="Filter product concepts">{collections.map((item) => <button key={item} className={category === item ? "filter-chip selected" : "filter-chip"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-control"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an idea" aria-label="Search product concepts" /></label></div>
        <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} saved={savedIdeas.includes(product.id)} onSave={() => toggleSaved(product.id)} onDetails={() => setSelectedProduct(product)} onAdd={() => addToCart(product.id)} />)}</div>
        <p className="catalog-note"><ShieldCheck size={17} /> Concept catalog only. Supplier specifications, production costs, shipping, and final prices are not verified. No items can be purchased yet.</p>
      </section>

      <section className="digital-section" id="digital-designs"><div className="digital-preview"><img src="/mockups/digital-print-concept.svg" alt="Original botanical printable concept preview in a frame" /><span className="preview-sticker">ORIGINAL<br />ARTWORK</span></div><div className="digital-copy"><p className="eyebrow">DIGITAL DESIGN SHOP · FIRST FILE DRAFT</p><h2>Small rituals,<br /><em>room to grow.</em></h2><p>A simple botanical line drawing and gentle reminder, created for this Natural Studio concept collection.</p><ul><li><Check size={16} /> Original, editable SVG artwork</li><li><Check size={16} /> Warm paper and forest-green palette</li><li><Check size={16} /> Digital file preview included</li></ul><div className="digital-price"><span>Draft price suggestion</span><strong>$ 8.00</strong></div><p className="muted-small">Formatted review packages are prepared locally. Final license approval and private download delivery are not enabled.</p><button className="secondary-button" onClick={() => addToCart("print")}>Add draft to research cart</button></div></section>

      <section className="section finder-section" id="gift-finder"><div className="section-heading"><div><p className="eyebrow">GIFT IDEAS, WITH A LITTLE MORE THOUGHT</p><h2>GiftFinder</h2><p>Filter original concept ideas by interest and a draft budget. No personal details are collected.</p></div><span className="section-mark">02 / 04</span></div>
        <div className="finder-layout"><form className="finder-controls" onSubmit={(event) => event.preventDefault()}><label>Draft budget ceiling ($)<input type="number" min="0" step="1" value={giftBudget} onChange={(event) => setGiftBudget(event.target.value)} /></label><fieldset><legend>What do they enjoy?</legend>{interests.map((interest) => <label className="check-option" key={interest}><input type="checkbox" checked={giftInterests.includes(interest)} onChange={() => toggleGiftInterest(interest)} />{interest}</label>)}</fieldset><p>Suggestions are based on the draft concepts shown on this site. Prices are recommendations only.</p></form>
        <div className="gift-results"><div className="result-heading"><strong>{gifts.length} ideas</strong><span>matching your selections</span></div>{gifts.length === 0 ? <div className="empty-card">No concepts match yet. Try a wider budget or another interest.</div> : gifts.map((product) => <article className="gift-result" key={product.id}><div className="gift-icon"><Gift size={19} /></div><div><strong>{product.name}</strong><small>{product.category} · draft suggestion $ {product.suggestedPrice}.00</small></div><button className={giftSaved.includes(product.id) ? "icon-action active" : "icon-action"} onClick={() => saveGift(product.id)} aria-label={giftSaved.includes(product.id) ? "Remove saved gift idea" : "Save gift idea"} aria-pressed={giftSaved.includes(product.id)}><Heart size={17} fill={giftSaved.includes(product.id) ? "currentColor" : "none"} /></button></article>)}</div></div>
        <div className="saved-gifts"><strong>Your saved ideas</strong><span>{giftSaved.length ? giftSaved.map((id) => products.find((product) => product.id === id)?.name).filter(Boolean).join(" · ") : "Saved in this browser when you find one."}</span></div>
      </section>

      <section className="pricewatch-section" id="price-watch"><div className="section-heading"><div><p className="eyebrow">YOUR NOTES, YOUR OBSERVATIONS</p><h2>PriceWatch</h2><p>Keep a record of prices you personally observe. Nothing is fetched automatically.</p></div><span className="section-mark">03 / 04</span></div>
        <div className="watch-layout"><form className="watch-form" onSubmit={addObservation}><h3>Add a manual observation</h3><label>Product name<input required maxLength={160} value={watchName} onChange={(event) => setWatchName(event.target.value)} placeholder="Name the item" /></label><label>Product page URL<input required type="url" value={watchUrl} onChange={(event) => setWatchUrl(event.target.value)} placeholder="https://…" /></label><div className="watch-fields"><label>Observed price ($)<input required type="number" min="0" step="0.01" value={watchPrice} onChange={(event) => setWatchPrice(event.target.value)} /></label><label>Date and time<input required type="datetime-local" value={watchDate} onChange={(event) => setWatchDate(event.target.value)} /></label></div>{watchError && <p className="form-error" role="alert">{watchError}</p>}<button className="primary-button" type="submit">Save observation <ArrowRight size={16} /></button><small>Stored only in this browser. Use the retailer's page as the source of truth.</small></form>
        <div className="watch-history"><div className="history-heading"><div><h3>Price notes</h3><p>Manual records · newest first</p></div><span className="history-count">{observations.length}</span></div>{orderedObservations.length === 0 ? <div className="empty-history"><CircleDollarSign size={30} /><p>Your observations will appear here after you add one.</p></div> : <div className="history-list">{orderedObservations.map((entry) => <article className="history-row" key={entry.id}><div><strong>{entry.name}</strong><a href={entry.url} target="_blank" rel="noopener noreferrer">Open retailer page</a></div><strong>$ {entry.price.toFixed(2)}</strong><span>{new Date(entry.observedAt).toLocaleString()}</span><small>Manual observation</small></article>)}</div>}<button className="disabled-alert" disabled title="Automated alerts require an approved data source and delivery service">Price alerts are not configured</button></div></div>
      </section>

      <section className="companion-band" id="shopping"><div className="companion-icon"><ShoppingBag size={28} /></div><div><p className="eyebrow">A USEFUL LITTLE SIDEKICK</p><h2>Keep every list in reach.</h2><p>Save the things you love, keep a wishlist, compare your own price notes, and plan purchases in Shopping Companion.</p></div><a className="light-button" href="https://shopping-companion.marksheininwork.workers.dev/" target="_blank" rel="noopener noreferrer">Open Shopping Companion <ArrowRight size={17} /></a></section>

      <section className="affiliate-section"><div><p className="eyebrow">AFFILIATE SHOPPING</p><h2>Recommendations with the relationship out in the open.</h2><p>Affiliate recommendations are not active yet. No merchant partnerships or commission links are verified.</p></div><div className="disclosure-card"><ShieldCheck size={22} /><strong>Disclosure framework ready</strong><span>Any future affiliate relationship will be labeled beside its recommendation, after authorization is confirmed.</span></div></section>

      <section className="section about-section" id="about"><div className="about-art"><img src="/designs/small-rituals-printable.svg" alt="Original Small Rituals botanical artwork" /></div><div><p className="eyebrow">A THOUGHTFUL PLACE TO BEGIN</p><h2>Natural Studio Commerce</h2><p className="about-lede">A home for original design, useful discoveries, and small tools that make shopping feel a little more considered.</p><p>Natural Studio is the print-on-demand division. Digital Design Shop offers original download ideas. The companion tools help people plan, compare, and discover gifts at their own pace.</p><p>We're building each division around accurate details, clear choices, and designs made from scratch.</p><div className="about-values"><span><Leaf size={16} /> Original first</span><span><Sparkles size={16} /> Useful over noisy</span><span><Check size={16} /> Clear about what's ready</span></div></div></section>

      <section className="contact-section" id="contact"><div><p className="eyebrow">SAY HELLO</p><h2>We'd love to hear what you're looking for.</h2><p>Guests can save a message draft in this browser. Signed-in requests are stored in your private account; the customer response address and staff reply workflow still need setup.</p></div><form onSubmit={submitContact}><label>Support topic<select value={contactCategory} onChange={(event) => setContactCategory(event.target.value)}><option value="order">Order question</option><option value="digital-download">Digital download</option><option value="product-question">Product question</option><option value="accessibility">Accessibility</option><option value="other">Something else</option></select></label><label>Your message<textarea value={contactDraft} onChange={(event) => { setContactDraft(event.target.value); setContactSubmitted(false); }} maxLength={2000} rows={5} placeholder="What would you like to ask?" /></label><button className="secondary-button" type="submit" disabled={!contactDraft.trim() || contactSaving}>{contactSaving ? "Saving request…" : accountProfile ? "Send support request" : "Save message draft"}</button>{contactSubmitted && <p role="status">{contactStatus}</p>}{!contactSubmitted && contactStatus && <p role="status">{contactStatus}</p>}</form></section>

      <section className="section account-section" id="account"><div className="section-heading"><div><p className="eyebrow">YOUR PRIVATE WORKSPACE</p><h2>Your space</h2><p>Guest lists and price notes stay in this browser. Your account adds cross-device order and support history.</p></div><span className="section-mark">04 / 04</span></div><div className="dashboard-grid"><article><Heart /><strong>{savedIdeas.length}</strong><span>Saved product ideas · this browser</span></article><article><Gift /><strong>{giftSaved.length}</strong><span>Gift ideas saved · this browser</span></article><article><ShoppingBag /><strong>{cart.length}</strong><span>Research cart concepts · this browser</span></article><article><CircleDollarSign /><strong>{observations.length}</strong><span>Manual price notes · this browser</span></article></div><div className="account-panel" aria-live="polite">{accountProfile ? <><p><strong>Signed in as {accountProfile.email}</strong></p><button className="secondary-button" onClick={() => void loadCustomerAccount()} disabled={accountLoading}>{accountLoading ? "Refreshing…" : "Refresh account"}</button><div className="account-history"><h3>Order history</h3>{accountOrders.length ? accountOrders.map((order) => <article key={order.id}><strong>{order.product_id}</strong><span>{order.status} · {new Intl.NumberFormat(undefined, { style: "currency", currency: order.currency.toUpperCase() }).format(order.amount_cents / 100)}</span>{order.status === "paid" && <a href={"/api/v1/customer/downloads/" + encodeURIComponent(order.id)}>Download purchase</a>}</article>) : <p>No orders are associated with this account yet.</p>}<h3>Support requests</h3>{accountSupport.length ? accountSupport.map((request) => <article key={request.id}><strong>{request.category}</strong><span>{request.status} · {new Date(request.created_at + "Z").toLocaleString()}</span><p>{request.message}</p></article>) : <p>No support requests yet.</p>}</div></> : <><p>{accountLoading ? "Loading your account…" : "Sign in with a verified email to view your account’s orders and support requests."}</p><a className="primary-button" href="/api/v1/customer/sign-in">Sign in with email <ArrowRight size={16} /></a></>}{accountError && <p className="form-error" role="alert">{accountError}</p>}</div></section>

      <section className="policy-section" id="policies"><div className="policy-heading"><div><p className="eyebrow">INFORMATION FOR CUSTOMERS</p><h2>Policies and practical details</h2></div><span className="draft-chip">Drafts · owner review needed</span></div><div className="policy-grid">
        <article><h3>Privacy</h3><p>Draft: guest saved concepts, gift ideas, research cart, price notes, and unsent contact drafts are stored in the current browser. Signed-in account identity, order history, and support requests are stored in the Natural Studio Commerce Cloudflare D1 service, with sign-in handled by Cloudflare Access email PIN. Confirm retention, logs, session cookies, support contact, payment, and download processing before publishing a final policy.</p></article>
        <article><h3>Terms</h3><p>Draft: this preview contains concept artwork and draft recommendations; it does not create a purchase contract. Final seller identity, intellectual-property terms, acceptable use, tax treatment, and consumer terms require owner review before launch.</p></article>
        <article><h3>Shipping</h3><p>Draft: physical concepts are not available for purchase. Confirm products, print provider, production timing, destinations, shipping charges, tracking, duties, and order support before publishing shipping commitments.</p></article>
        <article><h3>Returns</h3><p>Draft: no return or refund promise is made here. Confirm seller obligations, product-specific exceptions, damaged-item workflow, cancellation rules, and refund processing before accepting orders.</p></article>
      </div></section>
    </main>

    <footer className="site-footer"><a className="wordmark footer-wordmark" href="#home"><span className="brand-mark"><Leaf size={20} /></span><span>natural studio<small>COMMERCE</small></span></a><p>Original ideas, growing thoughtfully.</p><div><a href="#policies">Policies</a><a href="#contact">Contact</a><a href="#shopping">Shopping Companion</a></div><small>© Natural Studio Commerce · All concepts shown are drafts.</small></footer>

    {selectedProduct && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Close details"><X /></button><img src={selectedProduct.image} alt={selectedProduct.imageAlt} /><div><p className="eyebrow">{selectedProduct.division} · {selectedProduct.collection}</p><h2 id="modal-title">{selectedProduct.name}</h2><p>{selectedProduct.description}</p><p>{selectedProduct.details}</p><p className="modal-price">Draft price suggestion: <strong>$ {selectedProduct.suggestedPrice}.00</strong></p><button className="primary-button" onClick={() => { addToCart(selectedProduct.id); setSelectedProduct(null); }}>Add to research cart</button></div></section></div>}

    {cartOpen && <div className="modal-backdrop cart-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className="drawer-heading"><div><p className="eyebrow">RESEARCH CART</p><h2 id="cart-title">Saved concepts</h2></div><button className="modal-close" onClick={() => setCartOpen(false)} aria-label="Close cart"><X /></button></div>{cartProducts.length === 0 ? <div className="empty-card">Your cart is empty. Add a concept to keep it in your research list.</div> : <div className="cart-items">{cartProducts.map((product) => <article key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>Draft suggestion $ {product.suggestedPrice}.00 · not for sale</small></div><button className="icon-action" aria-label={"Remove " + product.name} onClick={() => setCart((previous) => previous.filter((id) => id !== product.id))}><Trash2 size={17} /></button></article>)}</div>}<div className="cart-total"><span>Draft suggestions subtotal</span><strong>$ {draftCartTotal.toFixed(2)}</strong></div><p className="cart-caveat">This is not a checkout total. Supplier costs, shipping, tax, final prices, terms, and payment setup have not been verified.</p><button className="checkout-button" disabled>Checkout unavailable · launch setup required</button></section></div>}
  </div>;
}
