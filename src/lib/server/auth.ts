import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, query } from "./db";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "pk_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 8;
const LOCK_MINUTES = 10;

export type User = {
  id: number;
  company_id: number;
  company_name: string;
  username: string;
  display_name: string;
  role: "admin" | "user";
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function login(username: string, password: string, userAgent?: string) {
  const u = await one<{ id: number; password_hash: string; active: boolean; locked_until: Date | null }>(
    "SELECT id, password_hash, active, locked_until FROM users WHERE lower(username) = lower($1)",
    [username.trim()],
  );
  if (u?.locked_until && u.locked_until > new Date()) {
    throw new AuthError(429, "به دلیل تلاش‌های ناموفق، حساب چند دقیقه قفل است. کمی بعد دوباره امتحان کنید.");
  }
  if (!u || !u.active || !verifyPassword(password, u.password_hash)) {
    if (u) {
      await query(
        `UPDATE users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE NULL END
         WHERE id = $1`,
        [u.id, MAX_FAILED, String(LOCK_MINUTES)],
      );
    }
    throw new AuthError(401, "نام کاربری یا رمز عبور اشتباه است.");
  }
  await query("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [u.id]);
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [sha256(token), u.id, String(SESSION_DAYS), (userAgent || "").slice(0, 300)],
  );
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export async function logout(token: string | undefined) {
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

export async function userFromToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  return one<User>(
    `SELECT u.id, u.company_id, c.name AS company_name, u.username, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN companies c ON c.id = u.company_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [sha256(token)],
  );
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** For pages: redirect to /login when not signed in. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdminPage(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

/** For API routes: throw AuthError (turned into JSON by `api()`). */
export async function apiUser(admin = false): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError(401, "ابتدا وارد شوید.");
  if (admin && u.role !== "admin") throw new AuthError(403, "این کار فقط برای مدیر مجاز است.");
  return u;
}
