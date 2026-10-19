import { api } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { exportRows } from "@/lib/server/products";

export const GET = api(async () => {
  const u = await apiUser();
  return { rows: await exportRows(u.company_id) };
});
