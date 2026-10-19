import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { one, query } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";

/** Change own password. */
export const POST = api(async (req: Request) => {
  const me = await apiUser();
  const b = await body<{ current?: string; password?: string }>(req);
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [me.id]);
  if (!row || !verifyPassword(String(b.current ?? ""), row.password_hash)) throw new BadRequest("رمز فعلی اشتباه است.");
  if (String(b.password ?? "").length < 8) throw new BadRequest("رمز جدید باید حداقل ۸ کاراکتر باشد.");
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [me.id, hashPassword(String(b.password))]);
  return { ok: true };
});
