import { pickBest } from "../match";
import type { CheckProduct, SiteResult } from "./types";

const toman = (price: number | null | undefined, currency: string | null | undefined) =>
  price ? (currency === "IRR" ? Math.round(price / 10) : price) : null;

/**
 * Re-check which search result is really our product (type + brand + model),
 * whatever source produced it. The best result is always shown with its price;
 * `match` says how sure we are: "exact", or "partial"/"weak" → a small «مطمئن شوید»
 * mark and the «این کالای درست است» button. Only exact or confirmed (pinned)
 * results count as lowest price / chart / export. Pinned pages are trusted as they are.
 */
export function evaluateResult(res: SiteResult, product: CheckProduct): SiteResult {
  if (res.pinned || res.match === "pinned" || res.kind === "product") return res;
  const pool = res.candidates?.length ? res.candidates : res.title ? [res as Required<Pick<SiteResult, "title">> & SiteResult] : [];
  if (!pool.length) return res;
  const best = pickBest(pool.map((c) => ({ ...c, title: c.title ?? "" })), product);
  if (!best) return res;
  const price_toman = toman(best.price, best.currency);
  const picked: SiteResult = {
    ...res,
    title: best.title,
    price: best.price ?? null,
    currency: best.currency === "IRR" ? "IRR" : "IRT",
    price_toman,
    url: best.url ?? res.url,
    in_stock: price_toman ? best.in_stock !== false : false,
    seller: best.seller ?? null,
    seller_count: best.seller_count ?? null,
    match: best.match,
  };
  return { ...picked, status: price_toman ? "ok" : "not_found", message: price_toman ? null : "کالا پیدا شد ولی قیمت ندارد (احتمالاً ناموجود)." };
}
