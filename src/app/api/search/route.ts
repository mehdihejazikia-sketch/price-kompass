import { api } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { searchProducts } from "@/lib/server/products";

export const GET = api(async (req: Request) => {
  const u = await apiUser();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return { results: await searchProducts(u.company_id, q.slice(0, 200), 10) };
});
