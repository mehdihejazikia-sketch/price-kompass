// Matching an uploaded product file against the products we already have.
// Pure function, used twice: in the browser for the preview and on the server
// when the import is applied, so the preview and the result always agree.
//
// Identity rules (our accounting export has all of these cases):
// - a code used by exactly one row in the file and one existing product → same product
//   (a changed name is a rename; prices and pinned links stay)
// - a code shared by several products → matched by code + normalized name
// - no code → matched by normalized name
// - identical rows (same code and name) are separate products, paired in order
import { defaultSearchTerm, extractModel } from "./model";
import { normalizeCode, normalizeName } from "./normalize";
import { cleanProduct, type CleanProduct, type ProductField, type ProductInput } from "./products";

export type ExistingProduct = {
  id: number;
  internal_code: string;
  name: string;
  brand: string;
  model: string;
  search_term: string;
  url_torob: string | null;
  url_digikala: string | null;
  url_emalls: string | null;
  sort_order: number | null;
  inactive: boolean;
};

export type FinalRow = Omit<ExistingProduct, "id" | "inactive">;

export type FileRow = CleanProduct & { idx: number; code_norm: string; name_norm: string };

export type Change = "name" | "code" | "model" | "search_term" | "brand" | "url" | "reactivate" | "sort";

export type Entry =
  | { kind: "new"; row: FileRow; final: FinalRow }
  | { kind: "match"; row: FileRow; existing: ExistingProduct; final: FinalRow; changes: Change[] };

export type Category = "new" | "name_changed" | "other_changed" | "unchanged";

export type DiffCounts = {
  total: number;
  new: number;
  name_changed: number;
  other_changed: number;
  unchanged: number;
  missing: number;
  invalid: number;
  no_code: number;
  dup_code_rows: number;
  dup_codes: number;
};

export type Diff = {
  entries: Entry[];
  missing: ExistingProduct[];
  invalid: { idx: number; name: string; code: string; reason: string }[];
  dupCodes: Set<string>;
  counts: DiffCounts;
};

export function categoryOf(e: Entry): Category {
  if (e.kind === "new") return "new";
  if (e.changes.includes("name")) return "name_changed";
  if (e.changes.some((c) => c !== "sort")) return "other_changed";
  return "unchanged";
}

/** Does this entry need a database write? (row order changes are silent) */
export function needsWrite(e: Entry): boolean {
  return e.kind === "new" || e.changes.length > 0;
}

const bySort = (a: ExistingProduct, b: ExistingProduct) =>
  (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function diffProducts(inputs: ProductInput[], existing: ExistingProduct[], provided: ProductField[]): Diff {
  const has = new Set(provided);
  const invalid: Diff["invalid"] = [];
  const rows: FileRow[] = [];
  inputs.forEach((input, idx) => {
    const { product, errors } = cleanProduct(input);
    const fatal = errors.filter((e) => !e.includes("لینک"));
    if (!product.name && !product.internal_code) return; // blank line
    if (fatal.length) {
      invalid.push({ idx, name: product.name, code: product.internal_code, reason: fatal.join("، ") });
      return;
    }
    rows.push({ ...product, idx, code_norm: normalizeCode(product.internal_code), name_norm: normalizeName(product.name) });
  });

  const matched = new Map<number, ExistingProduct>(); // file idx → product
  const used = new Set<number>(); // product ids
  const pair = (f: FileRow, e: ExistingProduct) => {
    matched.set(f.idx, e);
    used.add(e.id);
  };
  const pairByName = (F: FileRow[], E: ExistingProduct[]) => {
    for (const f of F) {
      if (matched.has(f.idx)) continue;
      const e = E.find((x) => !used.has(x.id) && normalizeName(x.name) === f.name_norm);
      if (e) pair(f, e);
    }
  };

  const exSorted = [...existing].sort(bySort);
  const exByCode = group(exSorted.filter((e) => normalizeCode(e.internal_code)), (e) => normalizeCode(e.internal_code));
  const exNoCode = group(exSorted.filter((e) => !normalizeCode(e.internal_code)), (e) => normalizeName(e.name));
  const fileByCode = group(rows.filter((r) => r.code_norm), (r) => r.code_norm);
  const fileNoCode = group(rows.filter((r) => !r.code_norm), (r) => r.name_norm);

  for (const [code, F] of fileByCode) {
    const E = exByCode.get(code) ?? [];
    if (F.length === 1 && E.length === 1) {
      pair(F[0], E[0]);
      continue;
    }
    pairByName(F, E);
    const fl = F.filter((f) => !matched.has(f.idx));
    const el = E.filter((e) => !used.has(e.id));
    if (fl.length === 1 && el.length === 1) pair(fl[0], el[0]); // one renamed product inside a shared code
  }
  for (const [name, F] of fileNoCode) pairByName(F, exNoCode.get(name) ?? []);

  // A product that gained (or lost) its code in the accounting system: same name.
  const leftoverEx = exSorted.filter((e) => !used.has(e.id));
  const leftoverByName = group(leftoverEx, (e) => normalizeName(e.name));
  for (const f of rows) {
    if (matched.has(f.idx)) continue;
    const e = (leftoverByName.get(f.name_norm) ?? []).find((x) => !used.has(x.id));
    if (e) pair(f, e);
  }

  const entries: Entry[] = rows.map((row) => {
    const e = matched.get(row.idx);
    if (!e) return { kind: "new", row, final: finalForNew(row) };
    const final = mergeRow(row, e, has);
    return { kind: "match", row, existing: e, final, changes: changesOf(e, final) };
  });

  const missing = exSorted.filter((e) => !used.has(e.id) && !e.inactive);
  const codeCount = new Map<string, number>();
  for (const r of rows) if (r.code_norm) codeCount.set(r.code_norm, (codeCount.get(r.code_norm) ?? 0) + 1);
  const dupCodes = new Set([...codeCount].filter(([, n]) => n > 1).map(([c]) => c));

  const counts: DiffCounts = {
    total: rows.length,
    new: 0,
    name_changed: 0,
    other_changed: 0,
    unchanged: 0,
    missing: missing.length,
    invalid: invalid.length,
    no_code: rows.filter((r) => !r.code_norm).length,
    dup_code_rows: rows.filter((r) => dupCodes.has(r.code_norm)).length,
    dup_codes: dupCodes.size,
  };
  for (const en of entries) counts[categoryOf(en)]++;
  return { entries, missing, invalid, dupCodes, counts };
}

function finalForNew(c: CleanProduct): FinalRow {
  const model = c.model || c.model_auto;
  return {
    internal_code: c.internal_code,
    name: c.name,
    brand: c.brand,
    model,
    search_term: c.search_term || defaultSearchTerm(c.name, model),
    url_torob: c.url_torob || null,
    url_digikala: c.url_digikala || null,
    url_emalls: c.url_emalls || null,
    sort_order: c.sort_order,
  };
}

/**
 * Update rules: name and code come from the file; brand, pinned links, model and
 * search term only when the cell is filled. A model/search term that was
 * auto-derived from the old name is re-derived when the name changes.
 */
export function mergeRow(c: FileRow, old: ExistingProduct, has: Set<ProductField>): FinalRow {
  const nameChanged = normalizeName(old.name) !== c.name_norm;
  const name = nameChanged ? c.name : old.name;
  const modelWasAuto = !old.model || old.model === extractModel(old.name);
  const model = c.model || (nameChanged && modelWasAuto ? c.model_auto || old.model : old.model || c.model_auto);
  const termWasAuto = !old.search_term || old.search_term === defaultSearchTerm(old.name, old.model);
  const search_term = c.search_term || (termWasAuto ? defaultSearchTerm(name, model) : old.search_term);
  return {
    internal_code: normalizeCode(old.internal_code) === c.code_norm ? old.internal_code : c.internal_code,
    name,
    brand: c.brand || old.brand,
    model,
    search_term,
    url_torob: c.url_torob || old.url_torob,
    url_digikala: c.url_digikala || old.url_digikala,
    url_emalls: c.url_emalls || old.url_emalls,
    sort_order: has.has("sort_order") && c.sort_order !== null ? c.sort_order : old.sort_order,
  };
}

function changesOf(old: ExistingProduct, f: FinalRow): Change[] {
  const ch: Change[] = [];
  if (old.name !== f.name) ch.push("name");
  if (old.internal_code !== f.internal_code) ch.push("code");
  if ((old.model || "") !== f.model) ch.push("model");
  if ((old.search_term || "") !== f.search_term) ch.push("search_term");
  if ((old.brand || "") !== f.brand) ch.push("brand");
  if (old.url_torob !== f.url_torob || old.url_digikala !== f.url_digikala || old.url_emalls !== f.url_emalls) ch.push("url");
  if (old.inactive) ch.push("reactivate");
  if (old.sort_order !== f.sort_order) ch.push("sort");
  return ch;
}

export const CHANGE_LABELS: Record<Change, string> = {
  name: "نام",
  code: "کد",
  model: "مدل",
  search_term: "عبارت جستجو",
  brand: "برند",
  url: "لینک",
  reactivate: "فعال‌سازی دوباره",
  sort: "ردیف",
};
