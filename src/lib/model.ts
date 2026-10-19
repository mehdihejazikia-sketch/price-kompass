import { toLatinDigits } from "./normalize";

// Latin "words" such as GDM-248CS, 24MK430H, SM-A556E/DS, RTX4060
const TOKEN = /[A-Za-z0-9]+(?:[-_/.][A-Za-z0-9]+)*/g;

/**
 * Pull the Latin model code out of a Farsi product name.
 * «مانیتور 24 اینچ جی پلاس مدل GDM-248CS» → "GDM-248CS".
 */
export function extractModel(name: string): string {
  const text = toLatinDigits(name || "");
  const tokens = [...text.matchAll(TOKEN)].map((m) => ({ t: m[0], i: m.index ?? 0 }));
  const candidates = tokens.filter(({ t }) => /[A-Za-z]/.test(t) && /\d/.test(t) && t.length >= 3);
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

/** What to type into the shop search boxes. */
export function defaultSearchTerm(name: string, model?: string): string {
  const m = (model || extractModel(name)).trim();
  return m || (name || "").trim();
}
