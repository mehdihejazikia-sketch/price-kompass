import { api, body } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { startImport } from "@/lib/server/products";

export const POST = api(async (req: Request) => {
  const u = await apiUser(true);
  const b = await body<{ fileName?: string; missingMode?: string }>(req);
  const importId = await startImport(u.company_id, u.id, String(b.fileName ?? ""), b.missingMode === "delete" ? "delete" : "deactivate");
  return { importId };
});
