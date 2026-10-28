export type Offer = { id: string; product: string; merchant: string; price: number; shipping: number; tax: number; observedAt: string; url?: string };
const KEY = "shopping-companion-offers-v1";
export function validOffer(value: unknown): value is Offer {
 if (!value || typeof value !== "object") return false;
 const o = value as Record<string, unknown>;
 return typeof o.id === "string" && typeof o.product === "string" && o.product.length > 0 && o.product.length <= 200 && typeof o.merchant === "string" && o.merchant.length > 0 && o.merchant.length <= 120 && ["price","shipping","tax"].every(k => typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) >= 0 && (o[k] as number) <= 1000000) && typeof o.observedAt === "string" && !Number.isNaN(Date.parse(o.observedAt)) && (o.url === undefined || (typeof o.url === "string" && /^https:\/\//.test(o.url)));
}
export function loadOffers(): Offer[] { try { const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(raw) ? raw.filter(validOffer).slice(0,1000) : []; } catch { return []; } }
export function saveOffers(offers: Offer[]): boolean { try { localStorage.setItem(KEY, JSON.stringify(offers.slice(0,1000))); return true; } catch { return false; } }
export function totalOffer(o: Offer): number { return Math.round((o.price + o.shipping + o.tax) * 100) / 100; }
export function cheapestOffer(offers: Offer[]): Offer | undefined { return [...offers].sort((a,b) => totalOffer(a)-totalOffer(b))[0]; }
