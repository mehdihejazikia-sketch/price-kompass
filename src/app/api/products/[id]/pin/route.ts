import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { setPin } from "@/lib/server/products";
import { isSite, urlBelongsToSite } from "@/lib/sites";

/**
 * «این کالای درست است»: pin the product page on that site, so future checks
 * open it directly. { site, url: null } removes the pin.
 */
export const POST = api(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { site, url } = await body<{ site?: string; url?: string | null }>(req);
  if (!isSite(site)) throw new BadRequest("سایت نامعتبر است.");
  if (url !== null && (typeof url !== "string" || !urlBelongsToSite(site, url))) throw new BadRequest("لینک متعلق به این سایت نیست.");
  const product = await setPin(u.company_id, Number((await ctx.params).id), site, url ? url.slice(0, 1000) : null);
  if (!product) throw new BadRequest("کالا پیدا نشد.");
  return { product };
});
