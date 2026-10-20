"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { faNum, formatToman } from "@/lib/format";
import { downloadProductsExcel } from "@/lib/exportExcel";
import type { Product } from "@/lib/products";

type Counts = { all: number; no_code: number; dup_code: number; inactive: number };
type Filter = keyof Counts;
const FILTERS: [Filter, string][] = [["all", "همه"], ["no_code", "بدون کد"], ["dup_code", "کد تکراری"], ["inactive", "غیرفعال"]];

export default function ProductsClient({ admin }: { admin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Product[]; total: number; counts: Counts } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ q, filter, page: String(page) });
    setData(await apiFetch(`/api/products?${sp}`));
  }, [q, filter, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function exportExcel() {
    setBusy(true);
    try {
      const { rows } = await apiFetch<{ rows: Parameters<typeof downloadProductsExcel>[0] }>("/api/products/export");
      const d = new Date().toISOString().slice(0, 10);
      await downloadProductsExcel(rows, `products-${d}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(p: Product, active: boolean) {
    await apiFetch(`/api/products/${p.id}`, { method: "PATCH", json: { active } });
    load();
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">کالاها</h1>
        <input
          className="input max-w-md"
          placeholder="جستجو با نام، مدل یا کد…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          aria-label="جستجو در کالاها"
        />
        <div className="ms-auto flex gap-2">
          <button className="btn-ghost" onClick={exportExcel} disabled={busy}>{busy ? "در حال آماده‌سازی…" : "دانلود اکسل"}</button>
          {admin && <Link href="/products/new" className="btn-primary">کالای جدید</Link>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setFilter(k); setPage(1); }}
            className={`badge px-3 py-1.5 text-sm ${filter === k ? "bg-accent text-accent-fg" : "bg-card text-muted ring-1 ring-border hover:text-fg"}`}
          >
            {label} {data && <span className="opacity-80">({faNum(data.counts[k])})</span>}
          </button>
        ))}
      </div>

      {filter === "dup_code" && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          این کدها در حسابداری برای بیش از یک کالا استفاده شده‌اند. هر کالا جداگانه نگه داشته می‌شود. بهتر است کد درست را در سیستم حسابداری اصلاح کنید.
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>ردیف</th><th>نام کالا</th><th>کد کالا</th><th>قیمت سطح ۱</th><th>قیمت سطح ۲</th><th>مدل</th><th></th></tr>
          </thead>
          <tbody>
            {data?.rows.map((p) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => router.push(`/products/${p.id}`)}>
                <td className="text-muted">{p.sort_order !== null ? faNum(p.sort_order) : ""}</td>
                <td className="font-medium">{p.name}</td>
                <td className="ltr whitespace-nowrap text-start">
                  {p.internal_code || <span className="badge bg-warn-soft text-warn">بدون کد</span>}
                  {p.dup_code && <span className="badge ms-1 bg-bad-soft text-bad">کد تکراری</span>}
                </td>
                <td className="whitespace-nowrap">{p.price_level1 ? formatToman(p.price_level1) : <span className="text-muted">—</span>}</td>
                <td className="whitespace-nowrap">{p.price_level2 ? formatToman(p.price_level2) : <span className="text-muted">—</span>}</td>
                <td className="ltr text-start text-muted">{p.model}</td>
                <td className="whitespace-nowrap text-end" onClick={(e) => e.stopPropagation()}>
                  {admin && (
                    <>
                      <Link href={`/products/${p.id}/edit`} className="btn-ghost px-2 py-1 text-xs">ویرایش</Link>{" "}
                      {p.inactive_at
                        ? <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setActive(p, true)}>فعال کردن</button>
                        : <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setActive(p, false)}>غیرفعال</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-muted">
                {data.counts.all === 0 && filter === "all" && !q ? <>هنوز کالایی ثبت نشده. {admin && <Link className="text-accent underline" href="/import">ورود از اکسل</Link>}</> : "کالایی پیدا نشد."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span>صفحه {faNum(page)} از {faNum(pages)} ({faNum(data.total)} کالا)</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button>
        </div>
      )}
    </div>
  );
}
