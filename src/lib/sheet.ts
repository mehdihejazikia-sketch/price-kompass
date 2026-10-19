// Excel / CSV reading for the import wizard. Runs in the browser; the file
// never leaves the computer, only the mapped rows are sent to the server.
import type { WorkBook, WorkSheet, CellObject } from "@e965/xlsx";
import { normalizeText } from "./normalize";
import { HEADER_SYNONYMS, PRODUCT_FIELDS, type ProductField, type ProductInput } from "./products";

export type Sheet = { name: string; rows: string[][] };
export type Mapping = Record<ProductField, number>; // column index or -1
export type ImportFormat = Partial<Record<ProductField, string>>; // field → header text

/**
 * Every cell as TEXT. Codes stay exactly as typed: no number conversion, no
 * lost leading zeros, no scientific notation (numeric cells are written out in
 * full; a zero-padded number format like 0000000000000 is honoured).
 */
export function cellToText(c: CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null) return "";
  if (c.t === "s") return String(c.v);
  if (c.t === "n" && typeof c.v === "number") {
    const fmt = typeof c.z === "string" ? c.z : "";
    if (/^0+$/.test(fmt) && c.w) return c.w; // zero-padded code format
    if (Number.isInteger(c.v)) return BigInt(c.v).toString();
    return c.w && !/e/i.test(c.w) ? c.w : String(c.v);
  }
  if (c.t === "b") return c.v ? "TRUE" : "FALSE";
  return c.w ?? String(c.v);
}

export function sheetRows(ws: WorkSheet, decodeRange: (r: string) => { s: { r: number; c: number }; e: { r: number; c: number } }, encodeCell: (a: { r: number; c: number }) => string): string[][] {
  if (!ws["!ref"]) return [];
  const range = decodeRange(ws["!ref"]);
  const out: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) row.push(cellToText(ws[encodeCell({ r, c })] as CellObject | undefined));
    out.push(row);
  }
  // trailing empty (or merged empty) rows are ignored
  while (out.length && out[out.length - 1].every((v) => v.trim() === "")) out.pop();
  return out;
}

/** CSV files from Excel on Windows are often Windows-1256, not UTF-8. */
export function decodeCsv(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if ((utf8.match(/�/g) || []).length > 2) {
    try {
      return new TextDecoder("windows-1256").decode(buf);
    } catch {}
  }
  return utf8.replace(/^﻿/, "");
}

export async function readWorkbook(file: File): Promise<Sheet[]> {
  const XLSX = await import("@e965/xlsx");
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  // raw: true → CSV values stay strings (no "00123" → 123)
  const wb: WorkBook = isCsv ? XLSX.read(decodeCsv(buf), { type: "string", raw: true }) : XLSX.read(buf, { type: "array", cellText: true, cellNF: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: sheetRows(wb.Sheets[name], XLSX.utils.decode_range, XLSX.utils.encode_cell),
  })).filter((s) => s.rows.length > 0);
}

const nh = (s: string) => normalizeText(s);

/**
 * Find the header row of a saved format: the first row (of the first 30) that
 * contains the format's name and code headers. Returns null when not found.
 */
export function detectFormat(rows: string[][], format: ImportFormat): { headerRow: number; map: Mapping } | null {
  const need = [format.name, format.internal_code].filter(Boolean).map((h) => nh(h!));
  if (!need.length) return null;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map(nh);
    if (!need.every((h) => cells.includes(h))) continue;
    const map = emptyMapping();
    const used = new Set<number>();
    for (const f of PRODUCT_FIELDS) {
      const h = format[f];
      if (!h) continue;
      const idx = cells.findIndex((c, j) => !used.has(j) && c === nh(h));
      if (idx >= 0) {
        map[f] = idx;
        used.add(idx);
      }
    }
    // optional extra columns (e.g. from our own export) by their usual names
    const extra = autoMap(rows[i]);
    for (const f of PRODUCT_FIELDS) if (map[f] < 0 && extra[f] >= 0 && !used.has(extra[f])) map[f] = extra[f];
    return { headerRow: i, map };
  }
  return null;
}

export function emptyMapping(): Mapping {
  return Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, -1])) as Mapping;
}

/** Guess columns from usual header names (manual-mapping fallback). */
export function autoMap(headers: string[]): Mapping {
  const norm = headers.map(nh);
  const used = new Set<number>();
  const map = emptyMapping();
  for (const pass of ["exact", "contains"] as const) {
    for (const field of PRODUCT_FIELDS) {
      if (map[field] >= 0) continue;
      for (const syn of HEADER_SYNONYMS[field].map(nh)) {
        const idx = norm.findIndex((h, i) => !used.has(i) && h && (pass === "exact" ? h === syn : syn.length >= 3 && h.includes(syn)));
        if (idx >= 0) {
          map[field] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return map;
}

/** Best guess of the header row when no saved format matched. */
export function guessHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const m = autoMap(rows[i]);
    if (m.name >= 0 && m.internal_code >= 0) return i;
  }
  for (let i = 0; i < Math.min(rows.length, 30); i++) if (rows[i].some((c) => c.trim())) return i;
  return 0;
}

export function formatFromMapping(headers: string[], map: Mapping): ImportFormat {
  const f: ImportFormat = {};
  for (const k of PRODUCT_FIELDS) if (map[k] >= 0 && headers[map[k]]) f[k] = headers[map[k]];
  return f;
}

export function mappedRows(rows: string[][], map: Mapping): ProductInput[] {
  return rows.map((r) => {
    const o: ProductInput = {};
    for (const f of PRODUCT_FIELDS) if (map[f] >= 0) o[f] = r[map[f]] ?? "";
    return o;
  });
}

export function providedFields(map: Mapping): ProductField[] {
  return PRODUCT_FIELDS.filter((f) => map[f] >= 0);
}

export function columnLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
