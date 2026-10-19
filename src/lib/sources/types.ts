// A "price source" reads the current price of one product on one site.
// Today: the browser extension. Later: official partner APIs (Torob/Digikala)
// or a search API, added without touching the UI (see ./index.ts).
import type { SiteId } from "../sites";

export type CheckProduct = {
  id: number;
  name: string;
  model: string;
  search_term: string;
  urls: Partial<Record<SiteId, string | null>>;
};

export type SiteResult = {
  site: SiteId;
  status: "ok" | "not_found" | "error";
  source: string;
  title?: string | null;
  /** price as the site gave it */
  price?: number | null;
  currency?: "IRT" | "IRR" | null;
  /** always Toman (Rial ÷ 10) */
  price_toman?: number | null;
  url?: string | null;
  in_stock?: boolean | null;
  seller?: string | null;
  seller_count?: number | null;
  /** exact = model code found in the title; partial/weak = please confirm; pinned = the confirmed product page */
  match?: "exact" | "partial" | "weak" | "pinned" | null;
  message?: string | null;
  page_url?: string | null;
  pinned?: boolean;
  checked_at?: string;
};

export type CheckHandlers = {
  progress?: (site: SiteId) => void;
  result: (r: SiteResult) => void;
};

export interface PriceSource {
  id: string;
  label: string;
  sites: readonly SiteId[];
  /** Is this source usable right now (extension installed, API configured…)? */
  available(): Promise<boolean>;
  check(product: CheckProduct, sites: SiteId[], on: CheckHandlers, signal?: AbortSignal): Promise<void>;
}
