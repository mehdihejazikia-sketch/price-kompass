import { execSync } from "node:child_process";
import pg from "pg";
import { TEST_DB } from "../playwright.config";

export default async function globalSetup() {
  const url = new URL(TEST_DB);
  const dbName = url.pathname.slice(1);
  if (!/test/.test(dbName)) throw new Error("refusing to reset a database whose name does not contain 'test'");
  const admin = new URL(TEST_DB);
  admin.pathname = "/postgres";
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${dbName}`);
  await c.end();
  execSync("node scripts/migrate.mjs", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DB, DATABASE_URL_UNPOOLED: "", ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin12345" },
  });
}
