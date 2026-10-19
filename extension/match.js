// Pick the search result that is really our product.
const DIG = "۰۱۲۳۴۵۶۷۸۹";
const ADIG = "٠١٢٣٤٥٦٧٨٩";

export function norm(s) {
  return String(s ?? "")
    .replace(/[۰-۹]/g, (d) => String(DIG.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ADIG.indexOf(d)))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export const compact = (s) => norm(s).replace(/\s+/g, "");

/** Score 0..100+: the Latin model code in the title is the strongest signal. */
export function score(candidate, product) {
  const title = compact(candidate.title);
  const model = compact(product.model);
  let s = 0;
  if (model && model.length >= 4 && title.includes(model)) s += 100;
  const tokens = norm(product.search_term || product.name).split(" ").filter((t) => t.length >= 2);
  if (tokens.length) {
    const hit = tokens.filter((t) => title.includes(t)).length;
    s += Math.round((50 * hit) / tokens.length);
  }
  if (candidate.price) s += 5;
  if (candidate.in_stock) s += 3;
  return s;
}

export function pickBest(candidates, product) {
  const scored = candidates
    .filter((c) => c && c.title)
    .map((c, i) => ({ c, s: score(c, product), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  if (!scored.length) return null;
  const { c, s } = scored[0];
  const model = compact(product.model);
  const match = model && model.length >= 4 ? (s >= 100 ? "exact" : s >= 40 ? "partial" : "weak") : s >= 45 ? "partial" : "weak";
  return { ...c, match, alternatives: scored.slice(1, 4).map((x) => ({ title: x.c.title, price: x.c.price, currency: x.c.currency, url: x.c.url })) };
}
