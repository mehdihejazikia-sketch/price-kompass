import "server-only";
import { isSite, SITES, urlBelongsToSite } from "@/lib/sites";
import { BadRequest } from "./api";
import { query } from "./db";

export type StoredCheck = {
  id: number;
  site: string;
  source: string;
  status: "ok" | "not_found" | "error";
  title: string | null;
  price_toman: number | null;
  price_raw: number | null;
  currency: string | null;
  url: string | null;
  in_stock: boolean | null;
  seller: string | null;
  seller_count: number | null;
  match: string | null;
  message: string | null;
  checked_at: string;
  checked_by_name?: string | null;
};

/**
 * Only results we are sure are this product count as its price (last known,
 * chart, lowest price, export): the model/type/brand matched, or the product
 * page was confirmed by a user. "partial" results are shown with a warning only.
 */
export const CONFIRMED = "(match IS NULL OR match IN ('exact', 'pinned'))";

const COLS = "c.id, c.site, c.source, c.status, c.title, c.price_toman, c.price_raw, c.currency, c.url, c.in_stock, c.seller, c.seller_count, c.match, c.message, c.checked_at";

const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const int = (v: unknown, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
};

/** Save live-check results (every check is kept: history is append-only). */
export async function saveChecks(companyId: number, productId: number, userId: number, results: unknown[]) {
  const rows = results.slice(0, 10).map((raw) => {
    const r = raw as Record<string, unknown>;
    if (!isSite(r.site)) throw new BadRequest("سایت نامعتبر است.");
    const status = r.status === "ok" || r.status === "not_found" ? r.status : "error";
    const currency = r.currency === "IRR" ? "IRR" : "IRT";
    const priceRaw = int(r.price, 1e13);
    let priceToman = int(r.price_toman, 1e12);
    if (priceRaw && !priceToman) priceToman = currency === "IRR" ? Math.round(priceRaw / 10) : priceRaw;
    const url = str(r.url, 1000);
    return {
      site: r.site,
      source: str(r.source, 40) ?? "extension",
      status: status === "ok" && !priceToman ? "not_found" : status,
      title: str(r.title, 300),
      price_toman: status === "ok" ? priceToman : null,
      price_raw: status === "ok" ? priceRaw : null,
      currency: status === "ok" ? currency : null,
      url: url && urlBelongsToSite(r.site, url) ? url : null,
      in_stock: typeof r.in_stock === "boolean" ? r.in_stock : null,
      seller: str(r.seller, 120),
      seller_count: int(r.seller_count, 100000),
      match: str(r.match, 20),
      message: str(r.message, 300),
    };
  });
  if (!rows.length) return [];
  return query<StoredCheck>(
    `INSERT INTO price_checks AS c (company_id, product_id, checked_by, site, source, status, title, price_toman, price_raw, currency, url, in_stock, seller, seller_count, match, message)
     SELECT $1, p.id, $3, x.site, x.source, x.status, x.title, x.price_toman, x.price_raw, x.currency, x.url, x.in_stock, x.seller, x.seller_count, x.match, x.message
       FROM jsonb_to_recordset($4::jsonb) AS x(site text, source text, status text, title text, price_toman bigint, price_raw bigint, currency text,
            url text, in_stock boolean, seller text, seller_count int, match text, message text)
       JOIN products p ON p.id = $2 AND p.company_id = $1
     RETURNING ${COLS}`,
    [companyId, productId, userId, JSON.stringify(rows)],
  );
}

/** Last successful price per site ("last known"), shown instantly while the live check runs. */
export async function lastKnown(companyId: number, productId: number) {
  return query<StoredCheck>(
    `SELECT DISTINCT ON (c.site) ${COLS}, u.display_name AS checked_by_name
       FROM price_checks c LEFT JOIN users u ON u.id = c.checked_by
      WHERE c.company_id = $1 AND c.product_id = $2 AND c.status = 'ok' AND ${CONFIRMED}
      ORDER BY c.site, c.checked_at DESC`,
    [companyId, productId],
  );
}

/** Successful prices over time, for the chart. */
export async function priceHistory(companyId: number, productId: number, days = 180) {
  return query<{ site: string; price_toman: number; checked_at: string }>(
    `SELECT site, price_toman, checked_at FROM price_checks
      WHERE company_id = $1 AND product_id = $2 AND status = 'ok' AND price_toman IS NOT NULL AND ${CONFIRMED}
        AND checked_at > now() - ($3 || ' days')::interval
      ORDER BY checked_at`,
    [companyId, productId, String(days)],
  );
}

/** Recent checks of the whole company (history page). */
export async function recentChecks(companyId: number, opts: { limit?: number; site?: string; q?: string } = {}) {
  const params: unknown[] = [companyId, Math.min(opts.limit ?? 100, 500)];
  let where = "c.company_id = $1";
  if (opts.site && isSite(opts.site)) {
    params.push(opts.site);
    where += ` AND c.site = $${params.length}`;
  }
  return query<StoredCheck & { product_id: number; product_name: string; internal_code: string; checked_by_name: string | null }>(
    `SELECT ${COLS}, c.product_id, p.name AS product_name, p.internal_code, u.display_name AS checked_by_name
       FROM price_checks c JOIN products p ON p.id = c.product_id LEFT JOIN users u ON u.id = c.checked_by
      WHERE ${where}
      ORDER BY c.checked_at DESC LIMIT $2`,
    params,
  );
}

/** Products checked most recently (home page), with their lowest last price. */
export async function recentProducts(companyId: number, limit = 8) {
  return query<{ product_id: number; name: string; internal_code: string; checked_at: string; min_price: number | null }>(
    `SELECT p.id AS product_id, p.name, p.internal_code, x.checked_at,
            (SELECT min(price_toman) FROM (SELECT DISTINCT ON (site) price_toman, in_stock FROM price_checks
               WHERE product_id = p.id AND status = 'ok' AND ${CONFIRMED} ORDER BY site, checked_at DESC) l WHERE l.in_stock IS NOT FALSE) AS min_price
       FROM (SELECT product_id, max(checked_at) AS checked_at FROM price_checks WHERE company_id = $1
              GROUP BY product_id ORDER BY max(checked_at) DESC LIMIT $2) x
       JOIN products p ON p.id = x.product_id AND p.deleted_at IS NULL
      ORDER BY x.checked_at DESC`,
    [companyId, limit],
  );
}

export { SITES };
