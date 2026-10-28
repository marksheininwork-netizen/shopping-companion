import { useEffect, useState } from "react";
import { cheapestOffer, loadOffers, saveOffers, totalOffer, type Offer } from "./offerComparison";
export default function OfferComparison() {
 const [offers,setOffers] = useState<Offer[]>(loadOffers);
 const [product,setProduct]=useState(""); const [merchant,setMerchant]=useState("");
 const [price,setPrice]=useState("");const [shipping,setShipping]=useState("0");const [tax,setTax]=useState("0");const [url,setUrl]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{if(!saveOffers(offers))setError("Unable to save locally. Export or free storage space.");},[offers]);
 const best=cheapestOffer(offers);
 function add(e: React.FormEvent) {
 e.preventDefault(); const p=Number(price),s=Number(shipping),t=Number(tax);
 if(!product.trim()||!merchant.trim()||product.length>200||merchant.length>120||[p,s,t].some(n=>!Number.isFinite(n)||n<0||n>1000000)|| (url.trim()&&!/^https:\/\//.test(url.trim()))) {setError("Enter a product, merchant, valid nonnegative costs and an optional HTTPS link.");return;}
 if(offers.length>=1000){setError("Maximum 1000 offers.");return;}
 setOffers(old=>[{id:crypto.randomUUID(),product:product.trim(),merchant:merchant.trim(),price:p,shipping:s,tax:t,observedAt:new Date().toISOString(),...(url.trim()?{url:url.trim()}: {})},...old]);setError("");setMerchant("");setPrice("");setUrl("");
 }
 return <section aria-label="Compare saved offers" style={{padding:20,maxWidth:900,margin:"auto"}}>
 <h2>Compare offers</h2><p>Manually recorded prices only — not live quotes. Shipping and tax are estimates; check the retailer before buying.</p>
 <form onSubmit={add} style={{display:"grid",gap:10,gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}>
 <input aria-label="Product" required maxLength={200} placeholder="Product" value={product} onChange={e=>setProduct(e.target.value)}/>
 <input aria-label="Merchant" required maxLength={120} placeholder="Merchant" value={merchant} onChange={e=>setMerchant(e.target.value)}/>
 <input aria-label="Price" required type="number" min="0" max="1000000" step=".01" placeholder="Price" value={price} onChange={e=>setPrice(e.target.value)}/>
 <input aria-label="Shipping" required type="number" min="0" max="1000000" step=".01" value={shipping} onChange={e=>setShipping(e.target.value)}/>
 <input aria-label="Estimated tax" required type="number" min="0" max="1000000" step=".01" value={tax} onChange={e=>setTax(e.target.value)}/>
 <input aria-label="Product HTTPS URL" type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/>
 <button type="submit">Save offer</button></form>
 {error&&<p role="alert">{error}</p>}
 {best&&<p>Lowest recorded total: <strong>{best.merchant} — ${totalOffer(best).toFixed(2)}</strong> ({best.product}). This compares all recorded products; filter mentally by identical product before deciding.</p>}
 <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Product</th><th>Merchant</th><th>Recorded total</th><th>Recorded</th><th>Actions</th></tr></thead><tbody>
 {[...offers].sort((a,b)=>totalOffer(a)-totalOffer(b)).map(o=><tr key={o.id}><td>{o.product}</td><td>{o.merchant}</td><td>${totalOffer(o).toFixed(2)}</td><td>{new Date(o.observedAt).toLocaleDateString()}</td><td>{o.url&&<a href={o.url} target="_blank" rel="noopener noreferrer">Visit retailer</a>} <button type="button" onClick={()=>setOffers(old=>old.filter(x=>x.id!==o.id))} aria-label={`Delete offer from ${o.merchant}`}>Delete</button></td></tr>)}
 </tbody></table></div></section>;
}
