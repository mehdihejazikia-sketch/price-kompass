import "server-only";
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

// int8 (bigint, count(*)) → JS number. Prices and ids stay far below 2^53.
pg.types.setTypeParser(20, (v) => Number(v));

function connectionString() {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_URL || "";
}

const g = globalThis as unknown as { __pkPool?: pg.Pool };

function pool(): pg.Pool {
  if (!g.__pkPool) {
    const url = connectionString();
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__pkPool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 5000,
    });
    if (process.env.VERCEL) attachDatabasePool(g.__pkPool);
  }
  return g.__pkPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query(text, params as unknown[]);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
