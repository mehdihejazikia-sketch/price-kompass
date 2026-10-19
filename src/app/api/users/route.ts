import { api, body, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";
import { one, query } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

const USERNAME = /^[a-zA-Z0-9._-]{3,32}$/;

export const GET = api(async () => {
  const me = await apiUser(true);
  const users = await query(
    `SELECT id, username, display_name, role, active, last_login_at, created_at
       FROM users WHERE company_id = $1 ORDER BY created_at`,
    [me.company_id],
  );
  return { users };
});

export const POST = api(async (req: Request) => {
  const me = await apiUser(true);
  const b = await body<{ username?: string; display_name?: string; password?: string; role?: string }>(req);
  const username = String(b.username ?? "").trim();
  if (!USERNAME.test(username)) throw new BadRequest("نام کاربری باید ۳ تا ۳۲ حرف انگلیسی، عدد، نقطه یا خط تیره باشد.");
  if (String(b.password ?? "").length < 8) throw new BadRequest("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  const exists = await one("SELECT 1 FROM users WHERE lower(username) = lower($1)", [username]);
  if (exists) throw new BadRequest("این نام کاربری قبلاً ثبت شده است.");
  const role = b.role === "admin" ? "admin" : "user";
  const user = await one(
    `INSERT INTO users (company_id, username, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, role, active, created_at`,
    [me.company_id, username, String(b.display_name ?? "").trim().slice(0, 80), hashPassword(String(b.password)), role],
  );
  return { user };
});

export const PATCH = api(async (req: Request) => {
  const me = await apiUser(true);
  const b = await body<{ id?: number; active?: boolean; role?: string; password?: string; display_name?: string }>(req);
  const target = await one<{ id: number }>("SELECT id FROM users WHERE id = $1 AND company_id = $2", [b.id, me.company_id]);
  if (!target) throw new BadRequest("کاربر پیدا نشد.");
  if (target.id === me.id && (b.active === false || (b.role && b.role !== "admin"))) {
    throw new BadRequest("نمی‌توانید حساب مدیریت خودتان را غیرفعال کنید.");
  }
  if (b.password !== undefined) {
    if (String(b.password).length < 8) throw new BadRequest("رمز عبور باید حداقل ۸ کاراکتر باشد.");
    await query("UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1", [target.id, hashPassword(String(b.password))]);
    await query("DELETE FROM sessions WHERE user_id = $1", [target.id]);
  }
  if (typeof b.active === "boolean") {
    await query("UPDATE users SET active = $2 WHERE id = $1", [target.id, b.active]);
    if (!b.active) await query("DELETE FROM sessions WHERE user_id = $1", [target.id]);
  }
  if (b.role === "admin" || b.role === "user") await query("UPDATE users SET role = $2 WHERE id = $1", [target.id, b.role]);
  if (typeof b.display_name === "string") await query("UPDATE users SET display_name = $2 WHERE id = $1", [target.id, b.display_name.trim().slice(0, 80)]);
  return { ok: true };
});
