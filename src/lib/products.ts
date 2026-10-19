// Product shape + validation shared by the import wizard (browser) and the API.
import { extractModel, defaultSearchTerm } from "./model";
import { normalizeCode } from "./normalize";
import { SITES, urlBelongsToSite, type SiteId } from "./sites";

/** Import columns, in the order of our accounting export (then the optional extras). */
export const PRODUCT_FIELDS = ["name", "internal_code", "sort_order", "model", "search_term", "brand", "url_torob", "url_digikala", "url_emalls"] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];
export type ProductInput = Partial<Record<ProductField, string>>;

export type Product = {
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
  inactive_at: string | null;
  updated_at?: string;
  /** another active product has the same code */
  dup_code?: boolean;
};

export const FIELD_LABELS: Record<ProductField, string> = {
  name: "نام کالا",
  internal_code: "کد کالا",
  sort_order: "ردیف",
  model: "مدل",
  search_term: "عبارت جستجو",
  brand: "برند",
  url_torob: "لینک ترب",
  url_digikala: "لینک دیجی‌کالا",
  url_emalls: "لینک ایمالز",
};

export const urlField = (site: SiteId) => `url_${site}` as const;

export type CleanProduct = {
  internal_code: string;
  name: string;
  brand: string;
  model: string;
  model_auto: string;
  search_term: string;
  search_term_auto: string;
  sort_order: number | null;
  url_torob: string;
  url_digikala: string;
  url_emalls: string;
};

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\s ]+/g, " ").trim().slice(0, n);

/** Trim, derive model/search term, validate pinned URLs. The code is optional. */
export function cleanProduct(input: ProductInput): { product: CleanProduct; errors: string[] } {
  const errors: string[] = [];
  // keep the code as typed (text), only invisible characters and spaces removed
  const internal_code = normalizeCode(input.internal_code).slice(0, 64);
  const name = clip(input.name, 300);
  if (!name) errors.push("نام کالا خالی است");
  const model = clip(input.model, 80);
  const model_auto = extractModel(name);
  const search_term = clip(input.search_term, 200);
  const search_term_auto = defaultSearchTerm(name, model || model_auto);
  const sortRaw = normalizeCode(input.sort_order);
  const sort_order = /^\d{1,9}$/.test(sortRaw) ? Number(sortRaw) : null;
  const urls = {} as Record<`url_${SiteId}`, string>;
  for (const site of SITES) {
    const u = clip(input[urlField(site)], 1000);
    if (u && !urlBelongsToSite(site, u)) errors.push(`${FIELD_LABELS[urlField(site)]} معتبر نیست`);
    urls[urlField(site)] = u && urlBelongsToSite(site, u) ? u : "";
  }
  return {
    product: { internal_code, name, brand: clip(input.brand, 80), model, model_auto, search_term, search_term_auto, sort_order, ...urls },
    errors,
  };
}

// Header names people use in their Excel files (compared after normalizeText).
export const HEADER_SYNONYMS: Record<ProductField, string[]> = {
  name: ["نام کالا", "نام محصول", "شرح کالا", "نام", "عنوان", "شرح", "name", "product name", "product", "title"],
  internal_code: ["کد کالا", "کدکالا", "کد محصول", "internal code", "internal_code", "کد", "بارکد", "barcode", "code", "sku", "کد داخلی"],
  sort_order: ["ردیف", "row", "شماره ردیف"],
  model: ["مدل", "model"],
  search_term: ["عبارت جستجو", "کلمه جستجو", "search term", "search_term"],
  brand: ["برند", "مارک", "brand"],
  url_torob: ["لینک ترب", "url torob", "url_torob"],
  url_digikala: ["لینک دیجی کالا", "لینک دیجیکالا", "url digikala", "url_digikala"],
  url_emalls: ["لینک ایمالز", "url emalls", "url_emalls"],
};

/** Our accounting export: «نام کالا», «کد کالا», «رديف». Saved per company, editable. */
export const DEFAULT_IMPORT_FORMAT: Partial<Record<ProductField, string>> = {
  name: "نام کالا",
  internal_code: "کد کالا",
  sort_order: "رديف",
  model: "مدل",
  search_term: "عبارت جستجو",
};
