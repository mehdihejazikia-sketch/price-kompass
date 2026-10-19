// Text normalization for search. Used on the server (stored columns) and in
// the browser, so a product typed with Arabic ي/ك, half-spaces or Persian
// digits finds the same row.

const DIGITS: Record<string, string> = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));

/** Persian/Arabic-Indic digits → Latin digits. */
export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d);
}

/** Canonical Persian letters, Latin digits, lower case, single spaces. */
export function normalizeText(input: unknown): string {
  let s = String(input ?? "");
  s = toLatinDigits(s);
  s = s
    .replace(/[يىئ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ً-ٰٟـ]/g, "") // harakat, tatweel
    .replace(/[‌‍‎‏   ]/g, " "); // half-space & co
  s = s.toLowerCase();
  // keep letters (any script) and digits; everything else separates words
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Same as normalizeText but without any spaces: "GDM 248-CS" ≈ "gdm248cs". */
export function compactText(input: unknown): string {
  return normalizeText(input).replace(/\s+/g, "");
}

/** Internal codes: Latin digits, no spaces, Excel's "88724.0" → "88724". */
export function normalizeCode(input: unknown): string {
  let s = toLatinDigits(String(input ?? "")).trim();
  s = s.replace(/[\s‌‏‎]+/g, "");
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  return s;
}

export function searchColumns(p: { internal_code: string; name: string; brand?: string; model?: string; search_term?: string }) {
  const all = [p.internal_code, p.name, p.brand, p.model, p.search_term].filter(Boolean).join(" ");
  return { search_norm: normalizeText(all), search_compact: compactText(all) };
}
