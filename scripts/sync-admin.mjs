// Creates or updates the admin account from ADMIN_USERNAME / ADMIN_PASSWORD on
// every deploy, so the login in Vercel's environment variables always works.
// The password itself is never printed.
import { hashPassword, verifyPassword } from "./password.mjs";

export async function syncAdmin(client, env = process.env, log = console) {
  const username = (env.ADMIN_USERNAME || "").trim();
  // values pasted into Vercel sometimes carry a trailing line break
  const password = (env.ADMIN_PASSWORD || "").replace(/[\r\n]+$/, "");
  if (!username || !password) {
    log.warn("[hooshmand] ADMIN_USERNAME / ADMIN_PASSWORD not set; admin user not synced.");
    return null;
  }
  if (password.length < 8) log.warn(`[hooshmand] the password for ${username} is shorter than 8 characters; please choose a longer one.`);

  const existing = (await client.query(
    "SELECT id, password_hash, role, active FROM users WHERE lower(username) = lower($1)",
    [username],
  )).rows[0];

  if (!existing) {
    let company = (await client.query("SELECT id FROM companies ORDER BY id LIMIT 1")).rows[0];
    if (!company) {
      company = (await client.query("INSERT INTO companies (name) VALUES ($1) RETURNING id", [env.ADMIN_COMPANY || "شرکت"])).rows[0];
    }
    await client.query(
      "INSERT INTO users (company_id, username, display_name, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')",
      [company.id, username, "مدیر", hashPassword(password)],
    );
    log.log(`[hooshmand] synced user ${username} (created)`);
    return "created";
  }

  const passwordChanged = !verifyPassword(password, existing.password_hash);
  await client.query(
    `UPDATE users SET role = 'admin', active = true, failed_logins = 0, locked_until = NULL
       ${passwordChanged ? ", password_hash = $2" : ""}
     WHERE id = $1`,
    passwordChanged ? [existing.id, hashPassword(password)] : [existing.id],
  );
  // a new password signs out the old sessions of that account
  if (passwordChanged) await client.query("DELETE FROM sessions WHERE user_id = $1", [existing.id]);
  const what = passwordChanged ? "password updated" : existing.role !== "admin" || !existing.active ? "made active admin" : "unchanged";
  log.log(`[hooshmand] synced user ${username} (${what})`);
  return passwordChanged ? "updated" : "unchanged";
}
