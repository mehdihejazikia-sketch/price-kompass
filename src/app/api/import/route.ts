import { api } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { existingForDiff, getImportFormat, importLog } from "@/lib/server/products";

/** Everything the wizard needs for the preview: saved format, current products, log. */
export const GET = api(async () => {
  const u = await apiUser(true);
  const [format, existing, log] = await Promise.all([getImportFormat(u.company_id), existingForDiff(u.company_id), importLog(u.company_id)]);
  return { format, existing, log };
});
