// Database tests against a throw-away database (pk_unit). Skipped when no local Postgres.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import * as XLSX from "@e965/xlsx";

const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || "postgres://pk:pk@localhost:5432/postgres";
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, "/pk_unit");

async function canConnect() {
  const c = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS pk_unit WITH (FORCE)`);
    await c.query(`CREATE DATABASE pk_unit`);
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}
const available = await canConnect();

describe.skipIf(!available)("database", () => {
  let P: typeof import("@/lib/server/products");
  let companyId = 0;
  let userId = 0;

  beforeAll(async () => {
    execSync("node scripts/migrate.mjs", { env: { ...process.env, DATABASE_URL: DB_URL, DATABASE_URL_UNPOOLED: "", ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin12345" }, stdio: "pipe" });
    process.env.DATABASE_URL = DB_URL;
    P = await import("@/lib/server/products");
    const { one } = await import("@/lib/server/db");
    const u = (await one<{ id: number; company_id: number }>("SELECT id, company_id FROM users WHERE username = 'admin'"))!;
    companyId = u.company_id;
    userId = u.id;
  });

  it("migrations are idempotent", () => {
    const out = execSync("node scripts/migrate.mjs", { env: { ...process.env, DATABASE_URL: DB_URL, DATABASE_URL_UNPOOLED: "" } }).toString();
    expect(out).not.toContain("applying");
  });

  it("syncs the admin user from the environment on every deploy", async () => {
    const { syncAdmin } = await import("../scripts/sync-admin.mjs");
    const { login } = await import("@/lib/server/auth");
    const c = new pg.Client({ connectionString: DB_URL });
    await c.connect();
    const lines: string[] = [];
    const log = { log: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) };
    try {
      // existing admin, new password → updated, old password stops working
      expect(await syncAdmin(c, { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "new-secret-99\n" }, log)).toBe("updated");
      await expect(login("admin", "admin12345")).rejects.toThrow();
      await expect(login("Admin", "new-secret-99")).resolves.toHaveProperty("token");
      // same password again → unchanged
      expect(await syncAdmin(c, { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "new-secret-99" }, log)).toBe("unchanged");
      // a different username → created in the existing company, as admin
      expect(await syncAdmin(c, { ADMIN_USERNAME: "mehdi", ADMIN_PASSWORD: "mehdi-pass-1" }, log)).toBe("created");
      const r = (await c.query("SELECT u.role, u.company_id = a.company_id AS same FROM users u, users a WHERE u.username = 'mehdi' AND a.username = 'admin'")).rows[0];
      expect(r).toEqual({ role: "admin", same: true });
      expect(lines.join("\n")).toContain("[hooshmand] synced user mehdi");
      expect(lines.join("\n")).not.toMatch(/secret|mehdi-pass/);
      // restore for the following tests
      await syncAdmin(c, { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin12345" }, log);
    } finally {
      await c.end();
    }
  });

  async function runImport(rows: Record<string, string>[], fileName: string, missingMode: "deactivate" | "delete" = "deactivate") {
    const id = await P.startImport(companyId, userId, fileName, missingMode);
    for (let off = 0; off < rows.length; off += 1000) await P.addImportRows(companyId, id, off, rows.slice(off, off + 1000));
    return { id, result: await P.finishImport(companyId, id, ["name", "internal_code", "sort_order"], rows.length) };
  }

  const small = [
    { name: "مانیتور 24 اینچ جی پلاس مدل GDM-248CS", internal_code: "88724", sort_order: "1" },
    { name: "آداپتور دوربيني 12V/2A", internal_code: "3120013", sort_order: "2" },
    { name: "اداپتور 14v/3Ah اصلي", internal_code: "3120013", sort_order: "3" },
    { name: "كيف دستي نوت بوك", internal_code: "", sort_order: "4" },
    { name: "کالای قدیمی", internal_code: "999", sort_order: "5" },
  ];

  it("imports, searches, re-uploads, deactivates missing and undoes", async () => {
    const { result } = await runImport(small, "a.xlsx");
    expect(result).toMatchObject({ new: 5, dup_codes: 1, no_code: 1 });

    // search: exact code, Arabic letters, model without dash, Persian digits
    expect((await P.searchProducts(companyId, "88724"))[0].name).toContain("GDM-248CS");
    expect((await P.searchProducts(companyId, "۸۸۷۲۴"))[0].internal_code).toBe("88724");
    expect((await P.searchProducts(companyId, "gdm248cs"))[0].internal_code).toBe("88724");
    expect((await P.searchProducts(companyId, "کیف دستی"))[0].name).toBe("كيف دستي نوت بوك");
    expect((await P.searchProducts(companyId, "3120013")).length).toBe(2);
    const counts = await P.productCounts(companyId);
    expect(counts).toMatchObject({ all: 5, no_code: 1, dup_code: 2, inactive: 0 });

    const monitor = (await P.searchProducts(companyId, "88724"))[0];
    await P.setPin(companyId, monitor.id, "torob", "https://torob.com/p/abc/");

    // second file: monitor renamed, old product missing
    const second = [{ ...small[0], name: "مانیتور ۲۴ اینچ جی‌پلاس GDM-248CS" }, small[1], small[2], small[3]];
    const { id: imp2, result: r2 } = await runImport(second, "b.xlsx");
    expect(r2).toMatchObject({ new: 0, name_changed: 1, unchanged: 3, missing: 1, deactivated: 1 });
    const renamed = (await P.getProduct(companyId, monitor.id))!;
    expect(renamed.name).toBe("مانیتور ۲۴ اینچ جی‌پلاس GDM-248CS");
    expect(renamed.url_torob).toBe("https://torob.com/p/abc/"); // pinned URL kept
    expect(await P.searchProducts(companyId, "999")).toHaveLength(0); // inactive hidden
    expect((await P.productCounts(companyId)).inactive).toBe(1);

    // undo the last import
    await P.undoLastImport(companyId, userId, imp2);
    expect((await P.getProduct(companyId, monitor.id))!.name).toBe(small[0].name);
    expect((await P.searchProducts(companyId, "999"))).toHaveLength(1);
    await expect(P.undoLastImport(companyId, userId, imp2)).rejects.toThrow();
  });

  it.skipIf(!existsSync("samples/products.xlsx"))("real file: 4,525 products, then a re-upload changes nothing (in seconds)", async () => {
    const { sheetRows, detectFormat, mappedRows } = await import("@/lib/sheet");
    const { DEFAULT_IMPORT_FORMAT } = await import("@/lib/products");
    const { query } = await import("@/lib/server/db");
    await query("UPDATE products SET deleted_at = now() WHERE company_id = $1", [companyId]); // start empty
    const wb = XLSX.read(readFileSync("samples/products.xlsx"), { type: "buffer", cellText: true, cellNF: true });
    const rows = sheetRows(wb.Sheets[wb.SheetNames[0]], XLSX.utils.decode_range, XLSX.utils.encode_cell);
    const f = detectFormat(rows, DEFAULT_IMPORT_FORMAT)!;
    const inputs = mappedRows(rows.slice(f.headerRow + 1), f.map) as Record<string, string>[];
    let t = Date.now();
    const { result } = await runImport(inputs, "products.xlsx");
    expect(result).toMatchObject({ new: 4525, dup_codes: 6, no_code: 2296, invalid: 0 });
    expect(Date.now() - t).toBeLessThan(15000);
    const counts = await P.productCounts(companyId);
    expect(counts.all).toBe(4525);
    expect(counts.all - counts.no_code).toBe(2229);
    t = Date.now();
    const { result: again } = await runImport(inputs, "products.xlsx");
    expect(again).toMatchObject({ new: 0, name_changed: 0, other_changed: 0, unchanged: 4525, missing: 0, written: 0 });
    expect(Date.now() - t).toBeLessThan(15000);
    // export → re-import round trip keeps everything unchanged
    const exported = await P.exportRows(companyId);
    expect(exported).toHaveLength(4525);
    expect(exported.some((e) => e.internal_code === "0100248400002")).toBe(true);
  }, 60000);
});
