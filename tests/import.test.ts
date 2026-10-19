import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";
import { categoryOf, diffProducts, type ExistingProduct } from "@/lib/importDiff";
import { DEFAULT_IMPORT_FORMAT } from "@/lib/products";
import { cellToText, detectFormat, mappedRows, providedFields, sheetRows } from "@/lib/sheet";

const SAMPLE = "samples/products.xlsx";

function rowsOf(buf: Buffer | ArrayBuffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellText: true, cellNF: true });
  return sheetRows(wb.Sheets[wb.SheetNames[0]], XLSX.utils.decode_range, XLSX.utils.encode_cell);
}

function toExisting(diff: ReturnType<typeof diffProducts>): ExistingProduct[] {
  return diff.entries.map((e, i) => ({ id: i + 1, ...e.final, inactive: false }));
}

describe("cells as text", () => {
  it("never turns codes into numbers or scientific notation", () => {
    expect(cellToText({ t: "n", v: 6260100248402 })).toBe("6260100248402");
    expect(cellToText({ t: "n", v: 1234567890123, w: "1.23457E+12" })).toBe("1234567890123");
    expect(cellToText({ t: "n", v: 100248400002, z: "0000000000000", w: "0100248400002" })).toBe("0100248400002");
    expect(cellToText({ t: "s", v: "0100248400002" })).toBe("0100248400002");
  });
});

describe("accounting format", () => {
  // a tiny file in the same shape: merged empty title row, header, rows, trailing empty merged rows
  function makeFile(data: (string | number)[][]) {
    const ws = XLSX.utils.aoa_to_sheet([["", "", ""], ["نام کالا", "کد کالا", "رديف"], ...data, ["", "", ""], ["", "", ""]]);
    ws["!merges"] = [XLSX.utils.decode_range("A1:C1")];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Page1");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("detects the header row and ignores trailing rows", () => {
    const rows = rowsOf(makeFile([["مانیتور 24 اینچ جی پلاس مدل GDM-248CS", "88724", "1"], [" كيف دستي ", "", "2"]]));
    const f = detectFormat(rows, DEFAULT_IMPORT_FORMAT)!;
    expect(f.headerRow).toBe(1);
    expect(f.map.name).toBe(0);
    expect(f.map.internal_code).toBe(1);
    expect(f.map.sort_order).toBe(2);
    const inputs = mappedRows(rows.slice(f.headerRow + 1), f.map);
    expect(inputs).toHaveLength(2);
    const d = diffProducts(inputs, [], providedFields(f.map));
    expect(d.entries[0].final.model).toBe("GDM-248CS");
    expect(d.entries[0].final.search_term).toBe("GDM-248CS");
    expect(d.counts.no_code).toBe(1);
  });

  it("re-upload: rename by unique code, duplicate codes by name, missing products", () => {
    const first = makeFile([
      ["آداپتور دوربيني 12V/2A", "3120013", "1"],
      ["اداپتور 14v/3Ah اصلي", "3120013", "2"],
      ["حافظه RAM 4G D4", "1210024", "3"],
      ["حافظه RAM 16G D5", "1210024", "4"],
      ["مانیتور GDM-248CS", "88724", "5"],
      ["کابل بدون کد", "", "6"],
      ["کالای حذفی", "555", "7"],
    ]);
    const rows1 = rowsOf(first);
    const f1 = detectFormat(rows1, DEFAULT_IMPORT_FORMAT)!;
    const d1 = diffProducts(mappedRows(rows1.slice(2), f1.map), [], providedFields(f1.map));
    expect(d1.counts.new).toBe(7);
    expect(d1.counts.dup_codes).toBe(2);
    const existing = toExisting(d1);

    const second = makeFile([
      ["کالای جدید", "777", "1"],
      ["اداپتور 14v/3Ah اصلي", "3120013", "2"],
      ["آداپتور دوربيني 12V/2A", "3120013", "3"],
      ["حافظه RAM 4G D4", "1210024", "4"],
      ["حافظه RAM 16G D5", "1210024", "5"],
      ["مانیتور ۲۴ اینچ GDM-248CS", "88724", "6"],
      ["كابل   بدون كد", "", "7"],
    ]);
    const rows2 = rowsOf(second);
    const d2 = diffProducts(mappedRows(rows2.slice(2), f1.map), existing, providedFields(f1.map));
    expect(d2.counts).toMatchObject({ new: 1, name_changed: 1, unchanged: 5, missing: 1 });
    const renamed = d2.entries.find((e) => categoryOf(e) === "name_changed")!;
    expect(renamed.kind === "match" && renamed.existing.id).toBe(5); // same product, keeps history
    const adapter = d2.entries.find((e) => e.row.name.startsWith("آداپتور"))!;
    expect(adapter.kind === "match" && adapter.existing.id).toBe(1);
    expect(d2.missing.map((m) => m.internal_code)).toEqual(["555"]);
  });
});

describe.skipIf(!existsSync(SAMPLE))("real accounting file (samples/products.xlsx)", () => {
  it("first import: 4,525 products, 2,229 with codes, 6 duplicate codes; re-upload changes nothing", () => {
    const t0 = Date.now();
    const rows = rowsOf(readFileSync(SAMPLE));
    const f = detectFormat(rows, DEFAULT_IMPORT_FORMAT)!;
    expect(f.headerRow).toBe(1);
    const inputs = mappedRows(rows.slice(f.headerRow + 1), f.map);
    const d = diffProducts(inputs, [], providedFields(f.map));
    expect(d.counts.total).toBe(4525);
    expect(d.counts.new).toBe(4525);
    expect(d.counts.total - d.counts.no_code).toBe(2229);
    expect(d.counts.dup_codes).toBe(6);
    expect(d.counts.invalid).toBe(0);
    // codes kept as text
    expect(d.entries.some((e) => e.final.internal_code === "0100248400002")).toBe(true);
    expect(d.entries.some((e) => e.final.internal_code === "2282610098500074")).toBe(true);

    const again = diffProducts(inputs, toExisting(d), providedFields(f.map));
    expect(again.counts).toMatchObject({ new: 0, name_changed: 0, other_changed: 0, unchanged: 4525, missing: 0 });
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
