import { pickBest } from "../match";
import { SITE_INFO } from "../sites";
import type { CheckProduct, SiteResult } from "./types";

const toman = (price: number | null | undefined, currency: string | null | undefined) =>
  price ? (currency === "IRR" ? Math.round(price / 10) : price) : null;

/**
 * Re-check which search result is really our product (type + brand + model),
 * whatever source produced it. A wrong product never becomes "the price": it
 * turns into not_found with the closest result as a suggestion the user can
 * confirm. Confirmed product pages (pinned) are trusted as they are.
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
  if (best.match === "weak") {
    return {
      ...picked,
      status: "not_found",
      price: null,
      price_toman: null,
      message: `کالای مطابق در ${SITE_INFO[res.site].label} پیدا نشد.`,
      suggestion: { title: best.title, price_toman, url: best.url ?? null },
    };
  }
  return { ...picked, status: price_toman ? "ok" : "not_found", message: price_toman ? null : "کالا پیدا شد ولی قیمت ندارد (احتمالاً ناموجود)." };
}
