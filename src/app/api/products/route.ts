import { api, body } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { listProducts, saveProduct, type ListFilter } from "@/lib/server/products";
import type { ProductInput } from "@/lib/products";

const FILTERS: ListFilter[] = ["all", "no_code", "dup_code", "inactive"];

export const GET = api(async (req: Request) => {
  const u = await apiUser();
  const sp = new URL(req.url).searchParams;
  const filter = (FILTERS as string[]).includes(sp.get("filter") ?? "") ? (sp.get("filter") as ListFilter) : "all";
  return listProducts(u.company_id, sp.get("q") ?? "", Number(sp.get("page") ?? 1) || 1, filter);
});

export const POST = api(async (req: Request) => {
  const u = await apiUser(true);
  return { product: await saveProduct(u.company_id, await body<ProductInput>(req)) };
});
