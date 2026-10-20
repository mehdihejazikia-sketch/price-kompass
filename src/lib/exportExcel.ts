"use client";

// "دانلود اکسل": the same layout as our accounting export «تابلوي قيمت کالاها»
// (title row, then «سطح 2», «سطح 1», «نام كالا», «كد كالا», «رديف», prices in Rial
// written like the accounting system: "16,500,000"), RTL sheet, codes as text,
// plus extra columns at the end. Re-uploading this file works like the original.
import { SITES, SITE_INFO } from "./sites";
import type { Product } from "./products";

type Row = Product & { prices: Record<string, number | null>; last_checked: string | null };

const rial = (toman: number | null | undefined) => (toman ? (toman * 10).toLocaleString("en-US") : "");

export async function downloadProductsExcel(rows: Row[], fileName = "products.xlsx") {
  const XLSX = await import("@e965/xlsx");
  const header = [
    "سطح 2", "", "سطح 1", "نام كالا", "كد كالا", "رديف",
    "مدل", "عبارت جستجو", ...SITES.map((s) => `قیمت ${SITE_INFO[s].label} (تومان)`), "آخرین بررسی",
  ];
  const fmtDate = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short" });
  const title = Array(header.length).fill("");
  title[1] = "تابلوي قيمت کالاها";
  const aoa: (string | number | null)[][] = [
    title,
    header,
    ...rows.map((r) => [
      rial(r.price_level2),
      "",
      rial(r.price_level1),
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
  // prices, codes and row numbers stay text (leading zeros, long barcodes), like the accounting file
  for (let i = 2; i < aoa.length; i++) {
    for (const c of [0, 2, 4, 5]) {
      const ref = XLSX.utils.encode_cell({ r: i, c });
      ws[ref] = { t: "s", v: String(aoa[i][c] ?? "") };
    }
  }
  ws["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
  ws["!cols"] = [{ wch: 14 }, { wch: 2 }, { wch: 14 }, { wch: 50 }, { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Page1");
  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: true }] };
  XLSX.writeFile(wb, fileName);
}
