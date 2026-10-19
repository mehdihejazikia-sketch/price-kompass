// Applies migrations/*.sql in order, once each, and creates the first admin.
// Runs on every Vercel build. Append-only: it never drops anything.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv, databaseUrl, sslFor } from "./env.mjs";
import { hashPassword } from "./password.mjs";

loadEnv();
const url = databaseUrl({ direct: true });
if (!url) {
  const msg = "[migrate] No DATABASE_URL set.";
  if (process.env.VERCEL) {
    console.error(msg + " Connect a Neon database to this Vercel project (Storage → Neon).");
    process.exit(1);
  }
  console.warn(msg + " Skipping migrations.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(727274)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const dir = path.join(process.cwd(), "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(dir, f), "utf8");
    if (/\b(DROP\s+TABLE|TRUNCATE|DROP\s+COLUMN)\b/i.test(sql) && !/-- allow-destructive/.test(sql)) {
      throw new Error(`${f} contains a destructive statement. Data safety rule: add data, never drop it.`);
    }
    console.log(`[migrate] applying ${f}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  const { rows } = await client.query("SELECT count(*)::int AS n FROM users");
  if (rows[0].n === 0) {
    const username = (process.env.ADMIN_USERNAME || "").trim();
    const password = process.env.ADMIN_PASSWORD || "";
    if (!username || password.length < 8) {
      console.warn("[migrate] No users yet. Set ADMIN_USERNAME and ADMIN_PASSWORD (8+ chars) and redeploy to create the admin.");
    } else {
      const company = (await client.query("INSERT INTO companies (name) VALUES ($1) RETURNING id",
        [process.env.ADMIN_COMPANY || "شرکت"])).rows[0];
      await client.query(
        "INSERT INTO users (company_id, username, display_name, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')",
        [company.id, username, "مدیر", hashPassword(password)]);
      console.log(`[migrate] created admin user "${username}"`);
    }
  }
  console.log("[migrate] done");
} finally {
  await client.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
  await client.end();
}
