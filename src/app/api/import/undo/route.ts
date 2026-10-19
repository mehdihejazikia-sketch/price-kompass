import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { undoLastImport } from "@/lib/server/products";

export const POST = api(async (req: Request) => {
  const u = await apiUser(true);
  const { importId } = await body<{ importId?: number }>(req);
  if (!Number.isInteger(importId)) throw new BadRequest("درخواست نامعتبر است.");
  return undoLastImport(u.company_id, u.id, importId!);
});
