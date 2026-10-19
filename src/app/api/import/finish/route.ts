import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { finishImport, saveImportFormat } from "@/lib/server/products";
import { PRODUCT_FIELDS, type ProductField } from "@/lib/products";
import type { ImportFormat } from "@/lib/sheet";

export const maxDuration = 60;

export const POST = api(async (req: Request) => {
  const u = await apiUser(true);
  const b = await body<{ importId?: number; provided?: string[]; expectedRows?: number; saveFormat?: ImportFormat }>(req);
  if (!Number.isInteger(b.importId) || !Number.isInteger(b.expectedRows)) throw new BadRequest("درخواست نامعتبر است.");
  const provided = (b.provided ?? []).filter((f): f is ProductField => (PRODUCT_FIELDS as readonly string[]).includes(f));
  if (!provided.includes("name")) throw new BadRequest("ستون نام کالا باید انتخاب شود.");
  const result = await finishImport(u.company_id, b.importId!, provided, b.expectedRows!);
  if (b.saveFormat) await saveImportFormat(u.company_id, b.saveFormat);
  return result;
});
