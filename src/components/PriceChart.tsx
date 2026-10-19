"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { faNum, formatDateTime, formatDay, formatToman } from "@/lib/format";
import { SITES, SITE_INFO, type SiteId } from "@/lib/sites";

export type HistoryPoint = { site: string; price_toman: number; checked_at: string };

const clock = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const millions = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const RANGES: [number, string][] = [[7, "۷ روز"], [30, "۳۰ روز"], [90, "۹۰ روز"], [180, "۶ ماه"]];
const H = 240;
const PAD = { top: 16, right: 72, bottom: 28, left: 64 };

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || Math.max(1, max * 0.1);
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

export function PriceChart({ history }: { history: HistoryPoint[] }) {
  const [days, setDays] = useState(30);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const since = Date.now() - days * 86400000;
    const pts = history.map((h) => ({ ...h, t: new Date(h.checked_at).getTime() })).filter((h) => h.t >= since);
    const bySite = Object.fromEntries(SITES.map((s) => [s, pts.filter((p) => p.site === s).sort((a, b) => a.t - b.t)])) as Record<SiteId, typeof pts>;
    return { pts, bySite };
  }, [history, days]);

  const { pts, bySite } = data;
  const sites = SITES.filter((s) => bySite[s].length);
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  let t0 = Math.min(...pts.map((p) => p.t));
  let t1 = Math.max(...pts.map((p) => p.t));
  if (!pts.length || t0 === t1) {
    t0 = (pts[0]?.t ?? Date.now()) - 12 * 3600000;
    t1 = (pts[0]?.t ?? Date.now()) + 12 * 3600000;
  }
  const prices = pts.map((p) => p.price_toman);
  const ticks = pts.length ? niceTicks(Math.min(...prices) * 0.98, Math.max(...prices) * 1.02) : [0, 1];
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  // axis labels in millions of Toman when prices are that large (unit in the caption)
  const inMillions = y0 >= 1_000_000 || y1 >= 10_000_000;
  const yLabel = (v: number) => (inMillions ? millions.format(v / 1_000_000) : faNum(v));
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - y0) / (y1 - y0 || 1)) * innerH;
  const times = [...new Set(pts.map((p) => p.t))].sort((a, b) => a - b);
  const xTicks = Array.from({ length: Math.min(5, Math.max(2, times.length)) }, (_, i) => t0 + ((t1 - t0) * i) / (Math.min(5, Math.max(2, times.length)) - 1));

  const valueAt = (site: SiteId, t: number) => {
    const list = bySite[site].filter((p) => p.t <= t);
    return list[list.length - 1] ?? null;
  };

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * innerW + PAD.left;
    let best = times[0], bd = Infinity;
    for (const t of times) {
      const d = Math.abs(x(t) - px);
      if (d < bd) [best, bd] = [t, d];
    }
    setHover(best ?? null);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="font-bold">روند قیمت</h2>
        {/* legend: always present for ≥2 series */}
        <ul className="flex flex-wrap gap-3 text-sm">
          {sites.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: SITE_INFO[s].color }} />
              {SITE_INFO[s].label}
            </li>
          ))}
        </ul>
        <div className="ms-auto flex gap-1" role="group" aria-label="بازه زمانی">
          {RANGES.map(([d, label]) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-md px-2.5 py-1 text-xs ${days === d ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-row"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={box} className="relative px-2 py-3" dir="ltr">
        {!pts.length ? (
          <p className="py-16 text-center text-sm text-muted" dir="rtl">در این بازه قیمتی ثبت نشده است. هر بار که قیمت بررسی شود، اینجا ثبت می‌شود.</p>
        ) : (
          <>
          <div className="absolute start-3 top-0 text-[11px] text-muted" dir="rtl">{inMillions ? "میلیون تومان" : "تومان"}</div>
          <svg width={width} height={H} role="img" aria-label="نمودار روند قیمت در هر سایت" className="block max-w-full">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
                <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">{yLabel(v)}</text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{t1 - t0 < 2 * 86400000 ? clock.format(new Date(t)) : formatDay(new Date(t))}</text>
            ))}
            {sites.map((s) => {
              const list = bySite[s];
              const d = list.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.price_toman).toFixed(1)}`).join("");
              const lastP = list[list.length - 1];
              return (
                <g key={s}>
                  <path d={d} fill="none" stroke={SITE_INFO[s].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {list.map((p) => (
                    <circle key={p.t} cx={x(p.t)} cy={y(p.price_toman)} r="4" fill={SITE_INFO[s].color} stroke="var(--card)" strokeWidth="2" />
                  ))}
                  {/* direct label at the line end */}
                  <text x={x(lastP.t) + 8} y={y(lastP.price_toman)} dominantBaseline="middle" fontSize="11" fill="var(--fg)">{SITE_INFO[s].label}</text>
                </g>
              );
            })}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeDasharray="3 3" />}
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
          </svg>
          </>
        )}
        {hover !== null && (
          <div
            dir="rtl"
            data-testid="chart-tooltip"
            className="card pointer-events-none absolute top-4 z-10 min-w-48 p-3 text-xs shadow-lg"
            style={x(hover) > width / 2 ? { right: width - x(hover) + 12 } : { left: x(hover) + 12 }}
          >
            <div className="mb-1.5 text-muted">{formatDateTime(new Date(hover))}</div>
            {sites.map((s) => {
              const v = valueAt(s, hover);
              return (
                <div key={s} className="flex items-center gap-2 py-0.5">
                  <span className="inline-block size-2 rounded-full" style={{ background: SITE_INFO[s].color }} />
                  <span className="flex-1">{SITE_INFO[s].label}</span>
                  <span className="font-semibold">{v ? formatToman(v.price_toman) : "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pts.length > 0 && (
        <details className="border-t border-border px-4 py-2 text-sm">
          <summary className="cursor-pointer text-muted">جدول داده‌ها ({faNum(pts.length)} مورد)</summary>
          <div className="max-h-64 overflow-auto">
            <table className="table">
              <thead><tr><th>زمان</th><th>سایت</th><th>قیمت</th></tr></thead>
              <tbody>
                {[...pts].sort((a, b) => b.t - a.t).map((p, i) => (
                  <tr key={i}><td>{formatDateTime(p.checked_at)}</td><td>{SITE_INFO[p.site as SiteId]?.label ?? p.site}</td><td>{formatToman(p.price_toman)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
