import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { getProduct, saveProduct, setActive, softDelete } from "@/lib/server/products";
import type { ProductInput } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest("شناسه نامعتبر است.");
  return id;
};

export const GET = api(async (_req: Request, ctx: Ctx) => {
  const u = await apiUser();
  const product = await getProduct(u.company_id, await idOf(ctx));
  if (!product) throw new BadRequest("کالا پیدا نشد.");
  return { product };
});

export const PUT = api(async (req: Request, ctx: Ctx) => {
  const u = await apiUser(true);
  return { product: await saveProduct(u.company_id, await body<ProductInput>(req), await idOf(ctx)) };
});

export const DELETE = api(async (_req: Request, ctx: Ctx) => {
  const u = await apiUser(true);
  await softDelete(u.company_id, await idOf(ctx));
  return { ok: true };
});

/** { active: boolean } → show/hide the product (inactive = hidden from search, history kept). */
export const PATCH = api(async (req: Request, ctx: Ctx) => {
  const u = await apiUser(true);
  const { active } = await body<{ active?: boolean }>(req);
  if (typeof active !== "boolean") throw new BadRequest("درخواست نامعتبر است.");
  await setActive(u.company_id, await idOf(ctx), active);
  return { ok: true };
});
