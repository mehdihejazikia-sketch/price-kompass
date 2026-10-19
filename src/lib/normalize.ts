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

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Internal codes are text (EAN barcodes up to 21 digits, leading zeros):
 * Latin digits, zero-width characters and spaces removed. Never a number.
 */
export function normalizeCode(input: unknown): string {
  return toLatinDigits(String(input ?? "")).replace(ZERO_WIDTH, "").replace(/\s+/g, "").trim();
}

/**
 * Product names for matching on re-upload (the original is kept for display):
 * ي→ی, ك→ک, Latin digits, zero-width characters removed, spaces collapsed,
 * Latin letters lower-cased. Punctuation is kept: "12V/7AH" ≠ "12V 7AH".
 */
export function normalizeName(input: unknown): string {
  return toLatinDigits(String(input ?? ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(ZERO_WIDTH, "")
    .replace(/[\s\u00A0]+/g, " ")
    .trim()
    .toLowerCase();
}

export function searchColumns(p: { internal_code: string; name: string; brand?: string | null; model?: string | null; search_term?: string | null }) {
  const all = [p.internal_code, p.name, p.brand, p.model, p.search_term].filter(Boolean).join(" ");
  return {
    search_norm: normalizeText(all),
    search_compact: compactText(all),
    code_norm: normalizeCode(p.internal_code),
    name_norm: normalizeName(p.name),
  };
}
