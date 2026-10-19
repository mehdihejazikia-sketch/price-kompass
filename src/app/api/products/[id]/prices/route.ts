import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { lastKnown, priceHistory, saveChecks } from "@/lib/server/prices";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest("شناسه نامعتبر است.");
  return id;
};

export const GET = api(async (_req: Request, ctx: Ctx) => {
  const u = await apiUser();
  const id = await idOf(ctx);
  const [last, history] = await Promise.all([lastKnown(u.company_id, id), priceHistory(u.company_id, id)]);
  return { last, history };
});

/** Body: { results: SiteResult[] } from the live check. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  const u = await apiUser();
  const { results } = await body<{ results?: unknown[] }>(req);
  if (!Array.isArray(results)) throw new BadRequest("درخواست نامعتبر است.");
  return { saved: await saveChecks(u.company_id, await idOf(ctx), u.id, results) };
});
