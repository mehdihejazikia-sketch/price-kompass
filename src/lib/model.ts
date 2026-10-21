import { toLatinDigits } from "./normalize";

// Latin "words" such as GDM-248CS, 24MK430H, SM-A556E/DS, RTX4060
const TOKEN = /[A-Za-z0-9]+(?:[-_/.][A-Za-z0-9]+)*/g;

/** 1.5m, 20v, 65W, 16GB… are sizes, not model codes (same rule as extension/match.js isSpecLike). */
const isSize = (t: string) => /^\d+([.,]\d+)?(m|cm|mm|v|a|ah|w|g|gb|tb|mb|mah|hz|ghz|k|inch|in|mp|ms)$/i.test(t.replace(/-/g, ""));

/**
 * Pull the Latin model code out of a Farsi product name.
 * «مانیتور 24 اینچ جی پلاس مدل GDM-248CS» → "GDM-248CS".
 */
export function extractModel(name: string): string {
  const text = toLatinDigits(name || "");
  const tokens = [...text.matchAll(TOKEN)].map((m) => ({ t: m[0], i: m.index ?? 0 }));
  const candidates = tokens.filter(({ t }) => /[A-Za-z]/.test(t) && /\d/.test(t) && t.length >= 3 && !isSize(t));
  if (!candidates.length) return "";
  // Prefer the token right after «مدل» if there is one.
  const modelIdx = text.search(/مدل/);
  if (modelIdx >= 0) {
    const after = candidates.find((c) => c.i > modelIdx);
    if (after) return after.t;
  }
  // Otherwise the longest letter+digit token.
  return candidates.reduce((a, b) => (b.t.length > a.t.length ? b : a)).t;
}

/**
 * What to type into the shop search boxes: the product name itself (type +
 * brand + model, e.g. «موس LOGITECH M-90»), cleaned. A bare model code like
 * "M-90" is too short: shops return every product with "M90" in its name.
 * Same cleaning as migrations/003_search_term_full_name.sql.
 */
export function defaultSearchTerm(name: string, _model?: string): string {
  return (name || "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
