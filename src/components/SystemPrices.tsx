import { formatDate, formatRial, formatToman, timeAgo } from "@/lib/format";

/** Our own selling prices from the accounting file, shown above the shop prices. */
export function SystemPrices({
  level1,
  level2,
  updatedAt,
  fileDate,
}: {
  level1: number | null;
  level2: number | null;
  updatedAt: string | null;
  fileDate: string | null;
}) {
  const tiles: [string, number | null][] = [["قیمت سطح ۱", level1], ["قیمت سطح ۲", level2]];
  return (
    <section className="card overflow-hidden" data-testid="system-prices">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="font-bold">قیمت‌های سیستم</h2>
        <span className="text-sm text-muted">از فایل حسابداری</span>
        <span className="ms-auto text-xs text-muted">
          {fileDate ? <>تاریخ فایل: {formatDate(fileDate)}</> : updatedAt ? <>به‌روزرسانی: {timeAgo(updatedAt)}</> : null}
        </span>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        {tiles.map(([label, v]) => (
          <div key={label} className="bg-card px-5 py-4">
            <div className="text-sm text-muted">{label}</div>
            {v ? (
              <>
                <div className="mt-1 text-2xl font-bold" data-testid={label === "قیمت سطح ۱" ? "level1" : "level2"}>{formatToman(v)}</div>
                <div className="text-xs text-muted">{formatRial(v * 10)}</div>
              </>
            ) : (
              <div className="mt-1 text-muted">در فایل قیمتی ثبت نشده</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
