import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { recentProducts } from "@/lib/server/prices";
import { formatToman, timeAgo } from "@/lib/format";
import { SearchBox } from "@/components/SearchBox";

export default async function Home() {
  const u = await requireUser();
  const recent = await recentProducts(u.company_id);
  const now = new Date();
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-[8vh]">
      <div className="text-center">
        <h1 className="text-2xl font-bold">استعلام قیمت کالا</h1>
        <p className="mt-2 text-muted">قیمت لحظه‌ای در دیجی‌کالا، ترب، ایمالز و هوشمند</p>
      </div>
      <SearchBox />
      <p className="text-center text-xs text-muted">
        <kbd>↑</kbd> <kbd>↓</kbd> انتخاب · <kbd>Enter</kbd> باز کردن · <kbd>Esc</kbd> پاک کردن
      </p>
      {recent.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-border px-4 py-2.5 text-sm font-bold text-muted">آخرین استعلام‌ها</h2>
          <ul>
            {recent.map((r) => (
              <li key={r.product_id} className="border-b border-border last:border-0">
                <Link href={`/products/${r.product_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-row">
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-sm font-semibold">{r.min_price ? formatToman(r.min_price) : ""}</span>
                  <span className="w-24 text-end text-xs text-muted">{timeAgo(r.checked_at, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
