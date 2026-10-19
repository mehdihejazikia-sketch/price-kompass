import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { recentChecks } from "@/lib/server/prices";
import { formatDateTime, formatRial, formatToman, timeAgo } from "@/lib/format";
import { SITES, SITE_INFO, isSite } from "@/lib/sites";

export const metadata = { title: "تاریخچه قیمت" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const u = await requireUser();
  const { site } = await searchParams;
  const rows = await recentChecks(u.company_id, { limit: 300, site: isSite(site) ? site : undefined });
  const now = new Date();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">تاریخچه قیمت</h1>
        <p className="text-sm text-muted">همه استعلام‌های همکاران شرکت، جدیدترین اول</p>
        <nav className="ms-auto flex gap-1">
          {[["", "همه سایت‌ها"], ...SITES.map((s) => [s, SITE_INFO[s].label])].map(([k, label]) => (
            <Link key={k} href={k ? `/history?site=${k}` : "/history"} className={`rounded-lg px-3 py-1.5 text-sm ${(site ?? "") === k ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-row"}`}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>زمان</th><th>کالا</th><th>سایت</th><th>قیمت</th><th>عنوان پیدا شده</th><th>کاربر</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted" title={formatDateTime(r.checked_at)}>{timeAgo(r.checked_at, now)}</td>
                <td>
                  <Link href={`/products/${r.product_id}`} className="hover:text-accent hover:underline">{r.product_name}</Link>
                  {r.internal_code && <span className="ltr ms-2 text-xs text-muted">{r.internal_code}</span>}
                </td>
                <td className="whitespace-nowrap">{SITE_INFO[r.site as keyof typeof SITE_INFO]?.label}</td>
                <td className="whitespace-nowrap">
                  {r.status === "ok" ? (
                    <>
                      <span className="font-semibold">{formatToman(r.price_toman)}</span>
                      {r.currency === "IRR" && <div className="text-xs text-muted">{formatRial(r.price_raw)}</div>}
                    </>
                  ) : (
                    <span className="text-xs text-bad">{r.status === "not_found" ? "پیدا نشد" : "خطا"}</span>
                  )}
                </td>
                <td className="max-w-sm truncate text-xs text-muted" title={r.title ?? r.message ?? ""}>
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.title}</a> : r.title ?? r.message}
                </td>
                <td className="whitespace-nowrap text-sm">{r.checked_by_name}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="py-10 text-center text-muted">هنوز قیمتی بررسی نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
