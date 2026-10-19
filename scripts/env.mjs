// Tiny .env loader for scripts (Next.js loads .env itself for the app).
import { existsSync, readFileSync } from "node:fs";

export function loadEnv(file = ".env") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

export function databaseUrl({ direct = false } = {}) {
  const e = process.env;
  return (
    (direct && (e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING)) ||
    e.DATABASE_URL ||
    e.POSTGRES_URL ||
    ""
  );
}

export function sslFor(url) {
  return /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false };
}
