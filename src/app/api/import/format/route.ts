import { api, body } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { saveImportFormat } from "@/lib/server/products";
import { DEFAULT_IMPORT_FORMAT } from "@/lib/products";
import type { ImportFormat } from "@/lib/sheet";

export const PUT = api(async (req: Request) => {
  const u = await apiUser(true);
  const b = await body<{ columns?: ImportFormat; reset?: boolean }>(req);
  await saveImportFormat(u.company_id, b.reset ? DEFAULT_IMPORT_FORMAT : (b.columns ?? {}));
  return { ok: true };
});
