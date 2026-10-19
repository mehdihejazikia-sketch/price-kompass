"use client";

// "دانلود اکسل": the same layout as our accounting export (empty merged title
// row, then «نام کالا», «کد کالا», «رديف»), RTL sheet, codes as text, plus
// extra columns at the end. Re-uploading this file works like the original.
import { SITES, SITE_INFO } from "./sites";
import type { Product } from "./products";

type Row = Product & { prices: Record<string, number | null>; last_checked: string | null };

export async function downloadProductsExcel(rows: Row[], fileName = "products.xlsx") {
  const XLSX = await import("@e965/xlsx");
  const header = ["نام کالا", "کد کالا", "رديف", "مدل", "عبارت جستجو", ...SITES.map((s) => `قیمت ${SITE_INFO[s].label} (تومان)`), "آخرین بررسی"];
  const fmtDate = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short" });
  const aoa: (string | number | null)[][] = [
    Array(header.length).fill(""),
    header,
    ...rows.map((r) => [
      r.name,
      r.internal_code,
      r.sort_order === null || r.sort_order === undefined ? "" : String(r.sort_order),
      r.model,
      r.search_term,
      ...SITES.map((s) => r.prices?.[s] ?? null),
      r.last_checked ? fmtDate.format(new Date(r.last_checked)) : "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // codes and row numbers stay text (leading zeros, long barcodes)
  for (let i = 2; i < aoa.length; i++) {
    for (const c of [1, 2]) {
      const ref = XLSX.utils.encode_cell({ r: i, c });
      if (ws[ref]) ws[ref] = { t: "s", v: String(aoa[i][c] ?? "") };
    }
  }
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  ws["!cols"] = [{ wch: 50 }, { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Page1");
  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: true }] };
  XLSX.writeFile(wb, fileName);
}
