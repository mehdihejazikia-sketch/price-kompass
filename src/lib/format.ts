const faNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export function faNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? faNumber.format(v) : String(n);
}

/** Persian digits for any string (codes, model numbers keep their letters). */
export function faDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function formatToman(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return `${faNum(Number(n))} تومان`;
}

export function formatRial(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return `${faNum(Number(n))} ریال`;
}

/** Store everything in Toman; Rial ÷ 10. */
export function toToman(value: number, currency: string | null | undefined): number {
  const c = (currency || "").toUpperCase();
  return c === "IRR" || c === "RIAL" ? Math.round(value / 10) : Math.round(value);
}

const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });

/** "۲ ساعت پیش" */
export function timeAgo(date: string | Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const sec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), "month");
  return rtf.format(Math.round(sec / (86400 * 365)), "year");
}

const dateFmt = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });

export function formatDateTime(date: string | Date): string {
  return dateFmt.format(typeof date === "string" ? new Date(date) : date);
}
export function formatDay(date: string | Date): string {
  return dayFmt.format(typeof date === "string" ? new Date(date) : date);
}
