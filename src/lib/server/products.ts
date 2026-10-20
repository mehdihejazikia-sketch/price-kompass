import "server-only";
import { compactText, normalizeCode, normalizeText, searchColumns } from "@/lib/normalize";
import { cleanProduct, DEFAULT_IMPORT_FORMAT, PRODUCT_FIELDS, type PriceUnit, type Product, type ProductField, type ProductInput } from "@/lib/products";
import { diffProducts, categoryOf, needsWrite, type DiffCounts, type ExistingProduct, type FinalRow } from "@/lib/importDiff";
import type { ImportFormat } from "@/lib/sheet";
import { BadRequest } from "./api";
import { one, query, tx } from "./db";

const COLS = `id, internal_code, name, brand, model, search_term, url_torob, url_digikala, url_emalls, url_hooshmand, sort_order, price_level1, price_level2, prices_updated_at, inactive_at, updated_at`;
const DUP = `(code_norm <> '' AND EXISTS (SELECT 1 FROM products d WHERE d.company_id = p.company_id AND d.code_norm = p.code_norm
              AND d.id <> p.id AND d.deleted_at IS NULL AND d.inactive_at IS NULL)) AS dup_code`;

export async function getProduct(companyId: number, id: number) {
  return one<Product>(`SELECT ${COLS}, ${DUP} FROM products p WHERE company_id = $1 AND id = $2 AND deleted_at IS NULL`, [companyId, id]);
}

export type SearchHit = Pick<Product, "id" | "internal_code" | "name" | "model" | "price_level1"> & { exact: boolean };

/**
 * Exact internal code first, then code prefix, then names/models containing
 * every word, then fuzzy (trigram) matches. Persian/Arabic letters, digits
 * and half-spaces are normalized on both sides. Inactive products are hidden.
 */
export async function searchProducts(companyId: number, raw: string, limit = 10, includeInactive = false): Promise<SearchHit[]> {
  const norm = normalizeText(raw);
  const compact = compactText(raw);
  const code = normalizeCode(raw);
  if (!norm && !code) return [];
  const tokens = norm.split(" ").filter(Boolean).slice(0, 8);
  const like = tokens.map((t) => `%${t.replace(/[%_\\]/g, "\\$&")}%`);
  const compactLike = `%${compact.replace(/[%_\\]/g, "\\$&")}%`;
  return query<SearchHit>(
    `SELECT id, internal_code, name, model, price_level1, (code_norm = $2) AS exact
       FROM products
      WHERE company_id = $1 AND deleted_at IS NULL AND ($8 OR inactive_at IS NULL) AND (
            (code_norm <> '' AND code_norm = $2)
         OR (length($2) >= 2 AND code_norm LIKE $2 || '%')
         OR (cardinality($3::text[]) > 0 AND search_norm LIKE ALL($3::text[]))
         OR (length($4) >= 3 AND search_compact LIKE $5)
         OR (length($6) >= 3 AND word_similarity($6, search_norm) >= 0.45)
      )
      ORDER BY (code_norm = $2) DESC,
               (code_norm LIKE $2 || '%') DESC,
               (search_norm LIKE ALL($3::text[])) DESC,
               (search_compact LIKE $5) DESC,
               word_similarity($6, search_norm) DESC,
               length(name), id
      LIMIT $7`,
    [companyId, code, like, compact, compactLike, norm, limit, includeInactive],
  );
}

export type ListFilter = "all" | "no_code" | "dup_code" | "inactive";

export async function listProducts(companyId: number, q: string, page: number, filter: ListFilter, size = 50) {
  const offset = Math.max(0, page - 1) * size;
  let ids: number[] | null = null;
  if (q.trim()) ids = (await searchProducts(companyId, q, 500, filter === "inactive")).map((h) => h.id);
  const where = [
    "company_id = $1",
    "deleted_at IS NULL",
    filter === "inactive" ? "inactive_at IS NOT NULL" : "inactive_at IS NULL",
    filter === "no_code" ? "code_norm = ''" : "",
    filter === "dup_code"
      ? `code_norm <> '' AND EXISTS (SELECT 1 FROM products d WHERE d.company_id = p.company_id AND d.code_norm = p.code_norm AND d.id <> p.id AND d.deleted_at IS NULL AND d.inactive_at IS NULL)`
      : "",
    ids ? "id = ANY($2::bigint[])" : "",
  ].filter(Boolean).join(" AND ");
  const params: unknown[] = [companyId];
  if (ids) params.push(ids);
  const order = ids ? "array_position($2::bigint[], id)" : filter === "dup_code" ? "code_norm, sort_order NULLS LAST, id" : "sort_order NULLS LAST, id";
  const [rows, total, counts] = await Promise.all([
    query<Product>(`SELECT ${COLS}, ${DUP} FROM products p WHERE ${where} ORDER BY ${order} LIMIT ${size} OFFSET ${offset}`, params),
    one<{ n: number }>(`SELECT count(*) AS n FROM products p WHERE ${where}`, params),
    productCounts(companyId),
  ]);
  return { rows, total: total?.n ?? 0, counts };
}

export async function productCounts(companyId: number) {
  return (await one<{ all: number; no_code: number; dup_code: number; inactive: number }>(
    `SELECT count(*) FILTER (WHERE inactive_at IS NULL) AS all,
            count(*) FILTER (WHERE inactive_at IS NULL AND code_norm = '') AS no_code,
            count(*) FILTER (WHERE inactive_at IS NULL AND code_norm <> '' AND code_norm IN (
              SELECT code_norm FROM products WHERE company_id = $1 AND deleted_at IS NULL AND inactive_at IS NULL AND code_norm <> ''
               GROUP BY code_norm HAVING count(*) > 1)) AS dup_code,
            count(*) FILTER (WHERE inactive_at IS NOT NULL) AS inactive
       FROM products WHERE company_id = $1 AND deleted_at IS NULL`,
    [companyId],
  ))!;
}

/** For the export: active products in file order, with the last price per site. */
export async function exportRows(companyId: number) {
  return query<Product & { prices: Record<string, number | null>; last_checked: string | null }>(
    `SELECT ${COLS},
            COALESCE((SELECT jsonb_object_agg(site, price_toman) FROM (
               SELECT DISTINCT ON (site) site, price_toman FROM price_checks
                WHERE product_id = p.id AND status = 'ok' AND (match IS NULL OR match IN ('exact', 'pinned')) ORDER BY site, checked_at DESC) x), '{}'::jsonb) AS prices,
            (SELECT max(checked_at) FROM price_checks WHERE product_id = p.id) AS last_checked
       FROM products p WHERE company_id = $1 AND deleted_at IS NULL AND inactive_at IS NULL
      ORDER BY sort_order NULLS LAST, id`,
    [companyId],
  );
}

function withSearch<T extends { internal_code: string; name: string; brand?: string | null; model?: string | null; search_term?: string | null }>(p: T) {
  return { ...p, ...searchColumns(p) };
}

/** Create or update one product from the form. A shared code is allowed (it gets flagged). */
export async function saveProduct(companyId: number, input: ProductInput, id?: number) {
  const { product, errors } = cleanProduct(input);
  if (errors.length) throw new BadRequest(errors.join("، "));
  const model = product.model || product.model_auto;
  const v = withSearch({ ...product, model, search_term: product.search_term || product.search_term_auto });
  const params: unknown[] = [v.internal_code, v.name, v.brand, v.model, v.search_term, v.url_torob || null, v.url_digikala || null, v.url_emalls || null,
    v.search_norm, v.search_compact, v.code_norm, v.name_norm, companyId, v.url_hooshmand || null];
  if (id) {
    const row = await one<Product>(
      `UPDATE products SET internal_code=$1, name=$2, brand=$3, model=$4, search_term=$5, url_torob=$6, url_digikala=$7, url_emalls=$8,
              search_norm=$9, search_compact=$10, code_norm=$11, name_norm=$12, url_hooshmand=$14, updated_at=now()
        WHERE company_id = $13 AND id = $15 AND deleted_at IS NULL RETURNING ${COLS}`,
      [...params, id],
    );
    if (!row) throw new BadRequest("کالا پیدا نشد.");
    return row;
  }
  return (await one<Product>(
    `INSERT INTO products (internal_code, name, brand, model, search_term, url_torob, url_digikala, url_emalls, search_norm, search_compact, code_norm, name_norm, company_id, url_hooshmand, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, (SELECT COALESCE(max(sort_order), 0) + 1 FROM products WHERE company_id = $13))
     RETURNING ${COLS}`,
    params,
  ))!;
}

export async function setPin(companyId: number, id: number, site: string, url: string | null) {
  const col = { torob: "url_torob", digikala: "url_digikala", emalls: "url_emalls", hooshmand: "url_hooshmand" }[site];
  if (!col) throw new BadRequest("سایت نامعتبر است.");
  return one<Product>(`UPDATE products SET ${col} = $3, updated_at = now() WHERE company_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING ${COLS}`, [companyId, id, url]);
}

export async function setActive(companyId: number, id: number, active: boolean) {
  await query(`UPDATE products SET inactive_at = ${active ? "NULL" : "now()"}, updated_at = now() WHERE company_id = $1 AND id = $2 AND deleted_at IS NULL`, [companyId, id]);
}

export async function softDelete(companyId: number, id: number) {
  await query("UPDATE products SET deleted_at = now() WHERE company_id = $1 AND id = $2", [companyId, id]);
}

// ───────────────────────────── import ─────────────────────────────

type Q = <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;

const EXISTING_SQL = `SELECT id, internal_code, name, brand, model, search_term, url_torob, url_digikala, url_emalls, url_hooshmand, sort_order, price_level1, price_level2,
                             (inactive_at IS NOT NULL) AS inactive
                        FROM products WHERE company_id = $1 AND deleted_at IS NULL`;

/** Identity data of all products, for the preview diff in the browser. */
export async function existingForDiff(companyId: number) {
  return query<ExistingProduct>(EXISTING_SQL + " ORDER BY id", [companyId]);
}

export async function getImportFormat(companyId: number): Promise<ImportFormat> {
  const row = await one<{ columns: ImportFormat }>("SELECT columns FROM import_formats WHERE company_id = $1", [companyId]);
  return row?.columns ?? DEFAULT_IMPORT_FORMAT;
}

export async function saveImportFormat(companyId: number, columns: ImportFormat) {
  const clean: ImportFormat = {};
  for (const f of PRODUCT_FIELDS) if (typeof columns[f] === "string" && columns[f]!.trim()) clean[f] = columns[f]!.trim().slice(0, 100);
  if (!clean.name) throw new BadRequest("ستون نام کالا باید مشخص باشد.");
  if (columns.price_unit === "IRR" || columns.price_unit === "IRT") clean.price_unit = columns.price_unit;
  await query(
    `INSERT INTO import_formats (company_id, columns) VALUES ($1, $2)
     ON CONFLICT (company_id) DO UPDATE SET columns = EXCLUDED.columns, updated_at = now()`,
    [companyId, JSON.stringify(clean)],
  );
}

export async function startImport(companyId: number, userId: number, fileName: string, missingMode: "deactivate" | "delete") {
  // stale unfinished uploads of this company are abandoned
  await query("DELETE FROM import_rows WHERE import_id IN (SELECT id FROM imports WHERE company_id = $1 AND status = 'staging')", [companyId]);
  const row = await one<{ id: number }>(
    "INSERT INTO imports (company_id, user_id, file_name, missing_mode) VALUES ($1, $2, $3, $4) RETURNING id",
    [companyId, userId, fileName.slice(0, 200), missingMode],
  );
  return row!.id;
}

async function stagingImport(companyId: number, importId: number) {
  const imp = await one<{ id: number; missing_mode: "deactivate" | "delete" }>(
    "SELECT id, missing_mode FROM imports WHERE id = $1 AND company_id = $2 AND status = 'staging'",
    [importId, companyId],
  );
  if (!imp) throw new BadRequest("این بارگذاری پیدا نشد یا قبلاً تمام شده است.");
  return imp;
}

export async function addImportRows(companyId: number, importId: number, offset: number, rows: ProductInput[]) {
  await stagingImport(companyId, importId);
  if (rows.length > 2000) throw new BadRequest("هر بسته حداکثر ۲۰۰۰ ردیف.");
  await query(
    `INSERT INTO import_rows (import_id, idx, data)
     SELECT $1, $2 + ord - 1, elem FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY AS t(elem, ord)
     ON CONFLICT (import_id, idx) DO UPDATE SET data = EXCLUDED.data`,
    [importId, offset, JSON.stringify(rows)],
  );
}

export type ImportResult = DiffCounts & { written: number; deactivated: number; deleted: number };

/** Apply the staged rows: the same diff as the preview, in one transaction, logged for undo. */
export async function finishImport(
  companyId: number,
  importId: number,
  provided: ProductField[],
  expectedRows: number,
  opts: { priceUnit?: PriceUnit; fileDate?: string | null } = {},
): Promise<ImportResult> {
  const imp = await stagingImport(companyId, importId);
  return tx(async (q) => {
    await q("SELECT pg_advisory_xact_lock(4242, $1)", [companyId]);
    const staged = await q<{ data: ProductInput }>("SELECT data FROM import_rows WHERE import_id = $1 ORDER BY idx", [importId]);
    if (staged.length !== expectedRows) throw new BadRequest("همه ردیف‌ها به سرور نرسیدند. دوباره تلاش کنید.");
    const existing = await q<ExistingProduct>(EXISTING_SQL, [companyId]);
    const diff = diffProducts(staged.map((s) => s.data), existing, provided, { priceUnit: opts.priceUnit ?? "IRR" });
    const hasPrices = provided.includes("price_level1") || provided.includes("price_level2");

    const inserts = diff.entries.filter((e) => e.kind === "new").map((e) => withSearch(e.final));
    const updates = diff.entries.filter((e) => e.kind === "match" && needsWrite(e)) as Extract<(typeof diff.entries)[number], { kind: "match" }>[];

    for (let i = 0; i < inserts.length; i += 1000) {
      const ids = await q<{ id: number }>(
        `INSERT INTO products (company_id, internal_code, name, brand, model, search_term, url_torob, url_digikala, url_emalls, url_hooshmand, sort_order,
                               price_level1, price_level2, prices_updated_at, search_norm, search_compact, code_norm, name_norm)
         SELECT $1, x.internal_code, x.name, x.brand, x.model, x.search_term, x.url_torob, x.url_digikala, x.url_emalls, x.url_hooshmand, x.sort_order,
                x.price_level1, x.price_level2, CASE WHEN x.price_level1 IS NOT NULL OR x.price_level2 IS NOT NULL THEN now() END,
                x.search_norm, x.search_compact, x.code_norm, x.name_norm
           FROM jsonb_to_recordset($2::jsonb) AS x(internal_code text, name text, brand text, model text, search_term text,
                url_torob text, url_digikala text, url_emalls text, url_hooshmand text, sort_order int, price_level1 bigint, price_level2 bigint,
                search_norm text, search_compact text, code_norm text, name_norm text)
         RETURNING id`,
        [companyId, JSON.stringify(inserts.slice(i, i + 1000))],
      );
      await q(
        "INSERT INTO import_changes (import_id, product_id, action) SELECT $1, unnest($2::bigint[]), 'insert'",
        [importId, ids.map((r) => r.id)],
      );
      if (hasPrices) await recordSystemPrices(q, companyId, importId, ids.map((r) => r.id));
    }

    for (let i = 0; i < updates.length; i += 1000) {
      const chunk = updates.slice(i, i + 1000);
      await q(
        `INSERT INTO import_changes (import_id, product_id, action, before)
         SELECT $1, p.id, 'update', jsonb_build_object('internal_code', p.internal_code, 'name', p.name, 'brand', p.brand, 'model', p.model,
                'search_term', p.search_term, 'url_torob', p.url_torob, 'url_digikala', p.url_digikala, 'url_emalls', p.url_emalls, 'url_hooshmand', p.url_hooshmand,
                'sort_order', p.sort_order, 'inactive_at', p.inactive_at,
                'price_level1', p.price_level1, 'price_level2', p.price_level2, 'prices_updated_at', p.prices_updated_at)
           FROM products p WHERE p.company_id = $2 AND p.id = ANY($3::bigint[])`,
        [importId, companyId, chunk.map((u) => u.existing.id)],
      );
      await q(
        `UPDATE products p SET internal_code = x.internal_code, name = x.name, brand = x.brand, model = x.model, search_term = x.search_term,
                url_torob = x.url_torob, url_digikala = x.url_digikala, url_emalls = x.url_emalls, url_hooshmand = x.url_hooshmand, sort_order = x.sort_order,
                prices_updated_at = CASE WHEN p.price_level1 IS DISTINCT FROM x.price_level1 OR p.price_level2 IS DISTINCT FROM x.price_level2
                                         THEN now() ELSE p.prices_updated_at END,
                price_level1 = x.price_level1, price_level2 = x.price_level2,
                search_norm = x.search_norm, search_compact = x.search_compact, code_norm = x.code_norm, name_norm = x.name_norm,
                inactive_at = NULL, updated_at = now()
           FROM jsonb_to_recordset($2::jsonb) AS x(id bigint, internal_code text, name text, brand text, model text, search_term text,
                url_torob text, url_digikala text, url_emalls text, url_hooshmand text, sort_order int, price_level1 bigint, price_level2 bigint,
                search_norm text, search_compact text, code_norm text, name_norm text)
          WHERE p.company_id = $1 AND p.id = x.id`,
        [companyId, JSON.stringify(chunk.map((u) => ({ id: u.existing.id, ...withSearch(u.final as FinalRow) })))],
      );
      const priced = chunk.filter((u) => u.changes.includes("price")).map((u) => u.existing.id);
      if (priced.length) await recordSystemPrices(q, companyId, importId, priced);
    }

    const missingIds = diff.missing.map((m) => m.id);
    let deactivated = 0, deleted = 0;
    if (missingIds.length && diff.entries.length > 0) {
      const action = imp.missing_mode === "delete" ? "delete" : "deactivate";
      await q(
        `INSERT INTO import_changes (import_id, product_id, action, before)
         SELECT $1, id, $3, jsonb_build_object('inactive_at', inactive_at, 'deleted_at', deleted_at) FROM products WHERE company_id = $2 AND id = ANY($4::bigint[])`,
        [importId, companyId, action, missingIds],
      );
      await q(
        `UPDATE products SET ${action === "delete" ? "deleted_at" : "inactive_at"} = now(), updated_at = now() WHERE company_id = $1 AND id = ANY($2::bigint[])`,
        [companyId, missingIds],
      );
      if (action === "delete") deleted = missingIds.length;
      else deactivated = missingIds.length;
    }

    const result: ImportResult = { ...diff.counts, written: inserts.length + updates.length, deactivated, deleted };
    await q("DELETE FROM import_rows WHERE import_id = $1", [importId]);
    await q(
      "UPDATE imports SET status = 'done', finished_at = now(), row_count = $2, counts = $3, has_prices = $4, file_date = $5 WHERE id = $1",
      [importId, staged.length, JSON.stringify(result), hasPrices, /^\d{4}-\d{2}-\d{2}$/.test(opts.fileDate ?? "") ? opts.fileDate : null],
    );
    return result;
  });
}

/** Append the current own prices of these products to their price history. */
async function recordSystemPrices(q: Q, companyId: number, importId: number, ids: number[]) {
  await q(
    `INSERT INTO system_prices (company_id, product_id, import_id, price_level1, price_level2)
     SELECT company_id, id, $2, price_level1, price_level2 FROM products WHERE company_id = $1 AND id = ANY($3::bigint[])`,
    [companyId, importId, ids],
  );
}

/** When the own prices were last imported, and the date printed in that file. */
export async function lastPriceImport(companyId: number) {
  return one<{ finished_at: string; file_date: string | null; file_name: string }>(
    `SELECT finished_at, to_char(file_date, 'YYYY-MM-DD') AS file_date, file_name FROM imports
      WHERE company_id = $1 AND status = 'done' AND has_prices ORDER BY finished_at DESC LIMIT 1`,
    [companyId],
  );
}

export async function importLog(companyId: number) {
  return query<{ id: number; file_name: string; status: string; row_count: number; counts: ImportResult | null; created_at: string; finished_at: string | null; undone_at: string | null; username: string | null }>(
    `SELECT i.id, i.file_name, i.status, i.row_count, i.counts, i.created_at, i.finished_at, i.undone_at, u.display_name AS username
       FROM imports i LEFT JOIN users u ON u.id = i.user_id
      WHERE i.company_id = $1 AND i.status <> 'staging' ORDER BY i.created_at DESC LIMIT 50`,
    [companyId],
  );
}

/** Undo the most recent completed import (only the latest one, so changes never interleave). */
export async function undoLastImport(companyId: number, userId: number, importId: number) {
  return tx(async (q: Q) => {
    await q("SELECT pg_advisory_xact_lock(4242, $1)", [companyId]);
    const last = (await q<{ id: number }>(
      "SELECT id FROM imports WHERE company_id = $1 AND status = 'done' ORDER BY finished_at DESC LIMIT 1",
      [companyId],
    ))[0];
    if (!last || last.id !== importId) throw new BadRequest("فقط آخرین ورود اکسل قابل بازگردانی است.");
    // products added by this import disappear from the list (soft delete keeps any price history)
    await q(
      `UPDATE products SET deleted_at = now() WHERE company_id = $1 AND id IN (SELECT product_id FROM import_changes WHERE import_id = $2 AND action = 'insert')`,
      [companyId, importId],
    );
    const updated = await q<{ product_id: number; before: Record<string, unknown> }>(
      "SELECT product_id, before FROM import_changes WHERE import_id = $1 AND action = 'update'",
      [importId],
    );
    if (updated.length) {
      const restored = updated.map((u) => ({ id: u.product_id, ...u.before, ...withSearch(u.before as unknown as FinalRow) }));
      await q(
        `UPDATE products p SET internal_code = x.internal_code, name = x.name, brand = x.brand, model = x.model, search_term = x.search_term,
                url_torob = x.url_torob, url_digikala = x.url_digikala, url_emalls = x.url_emalls, url_hooshmand = x.url_hooshmand, sort_order = x.sort_order,
                inactive_at = x.inactive_at, price_level1 = x.price_level1, price_level2 = x.price_level2, prices_updated_at = x.prices_updated_at,
                search_norm = x.search_norm, search_compact = x.search_compact, code_norm = x.code_norm,
                name_norm = x.name_norm, updated_at = now()
           FROM jsonb_to_recordset($2::jsonb) AS x(id bigint, internal_code text, name text, brand text, model text, search_term text,
                url_torob text, url_digikala text, url_emalls text, url_hooshmand text, sort_order int, inactive_at timestamptz,
                price_level1 bigint, price_level2 bigint, prices_updated_at timestamptz, search_norm text,
                search_compact text, code_norm text, name_norm text)
          WHERE p.company_id = $1 AND p.id = x.id`,
        [companyId, JSON.stringify(restored)],
      );
    }
    await q(
      `UPDATE products p SET inactive_at = (c.before->>'inactive_at')::timestamptz, deleted_at = (c.before->>'deleted_at')::timestamptz, updated_at = now()
         FROM import_changes c WHERE c.import_id = $2 AND c.action IN ('deactivate', 'delete') AND p.id = c.product_id AND p.company_id = $1`,
      [companyId, importId],
    );
    await q("UPDATE system_prices SET undone = true WHERE import_id = $1", [importId]);
    await q("UPDATE imports SET status = 'undone', undone_at = now(), undone_by = $2 WHERE id = $1", [importId, userId]);
    return { ok: true };
  });
}

export { categoryOf };
