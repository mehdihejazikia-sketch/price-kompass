import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { addImportRows } from "@/lib/server/products";
import { PRODUCT_FIELDS, type ProductInput } from "@/lib/products";

export const POST = api(async (req: Request) => {
  const u = await apiUser(true);
  const b = await body<{ importId?: number; offset?: number; rows?: unknown[] }>(req);
  if (!Array.isArray(b.rows) || !Number.isInteger(b.offset) || !Number.isInteger(b.importId)) throw new BadRequest("درخواست نامعتبر است.");
  const rows: ProductInput[] = b.rows.map((r) => {
    const o: ProductInput = {};
    for (const f of PRODUCT_FIELDS) {
      const v = (r as Record<string, unknown>)?.[f];
      if (v !== undefined && v !== null) o[f] = String(v).slice(0, 1000);
    }
    return o;
  });
  await addImportRows(u.company_id, b.importId!, b.offset!, rows);
  return { ok: true };
});
