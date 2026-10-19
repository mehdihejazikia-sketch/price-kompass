import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/products";
import { findServerSource } from "@/lib/server/sources";
import { isSite } from "@/lib/sites";

export const POST = api(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const src = findServerSource((await ctx.params).id);
  if (!src) throw new BadRequest("این منبع قیمت فعال نیست.");
  const { productId, site } = await body<{ productId?: number; site?: string }>(req);
  if (!isSite(site) || !src.sites.includes(site)) throw new BadRequest("سایت نامعتبر است.");
  const product = await getProduct(u.company_id, Number(productId));
  if (!product) throw new BadRequest("کالا پیدا نشد.");
  return { ...(await src.check(product, site)), source: src.id };
});
