"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { faNum, formatDateTime, formatRial, formatToman, timeAgo } from "@/lib/format";
import { SITES, SITE_INFO, searchUrl, type SiteId } from "@/lib/sites";
import { buildSources, evaluateResult, runCheck, type CheckProduct, type ServerSourceInfo, type SiteResult } from "@/lib/sources";
import { pingExtension } from "@/lib/sources/extension";
import type { StoredCheck } from "@/lib/server/prices";

type Row = { state: "idle" | "checking" | "done"; live?: SiteResult };
type ExtState = "detecting" | "missing" | "ready";

const MATCH: Record<string, [string, string]> = {
  exact: ["کالا مطابقت دارد", "bg-good-soft text-good"],
  pinned: ["لینک ثابت", "bg-accent-soft text-accent"],
  partial: ["مطمئن شوید", "bg-warn-soft text-warn"],
  weak: ["مطمئن شوید", "bg-warn-soft text-warn"],
};

export function PriceChecker({
  product,
  initialLast,
  serverSources,
  ownPrice = null,
  onSaved,
}: {
  product: CheckProduct;
  initialLast: StoredCheck[];
  serverSources: ServerSourceInfo[];
  /** our «سطح ۱» price, to compare each shop with */
  ownPrice?: number | null;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Record<SiteId, Row>>(() => Object.fromEntries(SITES.map((s) => [s, { state: "idle" }])) as Record<SiteId, Row>);
  const [last, setLast] = useState<Record<string, StoredCheck>>(() => Object.fromEntries(initialLast.map((c) => [c.site, c])));
  const [urls, setUrls] = useState(product.urls);
  const [ext, setExt] = useState<ExtState>("detecting");
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const abort = useRef<AbortController | null>(null);
  const sources = useMemo(() => buildSources(serverSources), [serverSources]);
  const term = product.search_term || product.model || product.name;

  // keep "۲ ساعت پیش" fresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const check = useCallback(
    async (sites: SiteId[] = [...SITES]) => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      setRunning(true);
      setRows((r) => ({ ...r, ...Object.fromEntries(sites.map((s) => [s, { state: "checking" }])) }));
      try {
        const unhandled = await runCheck(sources, { ...product, urls }, sites, {
          progress: (site) => setRows((r) => ({ ...r, [site]: { state: "checking" } })),
          result: (raw) => {
            const res = evaluateResult(raw, { ...product, urls });
            setRows((r) => ({ ...r, [res.site]: { state: "done", live: res } }));
            // save every result right away, so the history is kept even if the page is closed
            apiFetch<{ saved: StoredCheck[] }>(`/api/products/${product.id}/prices`, { method: "POST", json: { results: [{ ...res, candidates: undefined, suggestion: undefined }] } })
              .then(({ saved }) => {
                const ok = saved.find((s) => s.status === "ok");
                if (ok) setLast((l) => ({ ...l, [ok.site]: ok }));
                onSaved?.();
              })
              .catch(() => {});
          },
        }, ac.signal);
        if (unhandled.length) setRows((r) => ({ ...r, ...Object.fromEntries(unhandled.map((s) => [s, { state: "idle" }])) }));
      } finally {
        if (abort.current === ac) setRunning(false);
      }
    },
    [sources, product, urls, onSaved],
  );

  // detect the extension, then check automatically when the page opens
  useEffect(() => {
    let alive = true;
    (async () => {
      const [info, anyServer] = await Promise.all([pingExtension(), Promise.resolve(serverSources.length > 0)]);
      if (!alive) return;
      setExt(info.installed ? "ready" : "missing");
      if (info.installed || anyServer) check();
    })();
    return () => {
      alive = false;
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: R or F5-less re-check with "Alt+R"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "r" || e.key === "ق") && !running && ext === "ready") {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, running, ext]);

  async function pinAndRecheck(site: SiteId, url: string) {
    await pin(site, url);
    pendingRecheck.current = site;
  }
  const pendingRecheck = useRef<SiteId | null>(null);
  useEffect(() => {
    const site = pendingRecheck.current;
    if (site && !running) {
      pendingRecheck.current = null;
      check([site]);
    }
  }, [urls, running, check]);

  async function pin(site: SiteId, url: string | null) {
    const { product: p } = await apiFetch<{ product: { url_torob: string | null; url_digikala: string | null; url_emalls: string | null; url_hooshmand: string | null } }>(
      `/api/products/${product.id}/pin`,
      { method: "POST", json: { site, url } },
    );
    setUrls({ torob: p.url_torob, digikala: p.url_digikala, emalls: p.url_emalls, hooshmand: p.url_hooshmand });
    setRows((r) => {
      const live = r[site].live;
      return live ? { ...r, [site]: { ...r[site], live: { ...live, match: url ? "pinned" : live.match, pinned: !!url } } } : r;
    });
  }

  // lowest current price among in-stock results (live first, else last known)
  const display = SITES.map((site) => {
    const row = rows[site];
    const live = row.live;
    const l = last[site];
    const liveOk = live?.status === "ok";
    return {
      site,
      row,
      live,
      last: l,
      price: liveOk ? live!.price_toman ?? null : row.state === "checking" || !live ? l?.price_toman ?? null : null,
      confirmed: liveOk ? live!.match === "exact" || live!.match === "pinned" || !live!.match : true,
      inStock: liveOk ? live!.in_stock !== false : l?.in_stock !== false,
      fresh: liveOk,
    };
  });
  const candidates = display.filter((d) => d.price && d.inStock && d.confirmed);
  const lowest = candidates.length ? Math.min(...candidates.map((d) => d.price!)) : null;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="font-bold">قیمت در سایت‌ها</h2>
        <span className="text-sm text-muted">
          جستجو با: <span className="ltr font-medium text-fg">{term}</span>
        </span>
        <div className="ms-auto flex items-center gap-2">
          {ext === "ready" && <span className="badge bg-good-soft text-good">● افزونه فعال</span>}
          <button className="btn-primary" onClick={() => check()} disabled={running || ext !== "ready"} title="Alt+R">
            {running ? "در حال بررسی…" : "بررسی دوباره"}
          </button>
        </div>
      </div>

      {ext === "missing" && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-warn-soft px-4 py-3 text-sm text-warn" data-testid="ext-missing">
          <span>
            افزونه قیمت‌یاب روی این مرورگر نصب نیست یا فعال نیست؛ قیمت لحظه‌ای خوانده نمی‌شود. آخرین قیمت‌های ثبت‌شده نمایش داده می‌شود و می‌توانید هر سایت را دستی باز کنید.
          </span>
          <Link href="/extension" className="btn-ghost ms-auto px-3 py-1 text-xs">راهنمای نصب افزونه</Link>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table" data-testid="price-table">
          <thead>
            <tr>
              <th>سایت</th>
              <th>قیمت</th>
              {ownPrice ? <th>نسبت به سطح ۱</th> : null}
              <th>فروشنده</th>
              <th>موجودی</th>
              <th>لینک</th>
              <th>زمان بررسی</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {display.map(({ site, row, live, last: l, price, inStock, fresh }) => {
              const isLowest = !!price && price === lowest && inStock && display.find((d) => d.site === site)!.confirmed;
              const failed = live && live.status !== "ok";
              const shown = fresh ? live! : l;
              const pinnedUrl = urls[site];
              return (
                <tr key={site} data-testid={`row-${site}`} className={isLowest ? "bg-good-soft/60" : ""}>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span className="size-2.5 rounded-full" style={{ background: SITE_INFO[site].color }} />
                      {SITE_INFO[site].label}
                    </span>
                  </td>
                  <td className="min-w-64">
                    {row.state === "checking" && (
                      <div className="mb-1 flex items-center gap-2 text-xs text-accent">
                        <span className="inline-block size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        در حال بررسی…
                      </div>
                    )}
                    {price ? (
                      <div className={row.state === "checking" ? "opacity-50" : ""}>
                        <span className={`text-lg font-bold ${isLowest ? "text-good" : ""}`} data-testid={`price-${site}`}>{formatToman(price)}</span>
                        {isLowest && candidates.length > 1 && <span className="badge ms-2 bg-good text-card">کمترین قیمت</span>}
                        {fresh && live!.currency === "IRR" && live!.price && <div className="text-xs text-muted">({formatRial(live!.price)})</div>}
                        {!fresh && l && <div className="text-xs text-muted">آخرین قیمت ثبت‌شده</div>}
                      </div>
                    ) : failed ? (
                      <div className="text-sm text-bad" data-testid={`error-${site}`}>{live!.message || "قیمت خوانده نشد."}</div>
                    ) : row.state !== "checking" ? (
                      <span className="text-muted">—</span>
                    ) : null}
                    {failed && price && <div className="text-xs text-bad">{live!.message}</div>}
                    {failed && live!.suggestion && (
                      <div className="mt-1.5 max-w-md rounded-lg border border-border bg-row px-2.5 py-1.5 text-xs leading-relaxed" data-testid={`suggestion-${site}`}>
                        <span className="text-muted">نزدیک‌ترین نتیجه: </span>
                        {live!.suggestion.url ? <a href={live!.suggestion.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{live!.suggestion.title}</a> : live!.suggestion.title}
                        {live!.suggestion.price_toman ? <span className="ms-1 font-semibold">({formatToman(live!.suggestion.price_toman)})</span> : null}
                        {live!.suggestion.url && (
                          <button className="ms-2 text-accent underline" onClick={() => pinAndRecheck(site, live!.suggestion!.url!)}>همین کالاست</button>
                        )}
                      </div>
                    )}
                    {fresh && live!.title && (
                      <div className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                        {live!.title}{" "}
                        {live!.match && MATCH[live!.match] && <span className={`badge ${MATCH[live!.match][1]}`}>{MATCH[live!.match][0]}</span>}
                      </div>
                    )}
                  </td>
                  {ownPrice ? (
                    <td className="whitespace-nowrap text-sm" data-testid={`vs-${site}`}>
                      {price ? <VsOwn price={price} own={ownPrice} /> : <span className="text-muted">—</span>}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap text-sm">
                    {shown?.seller_count ? `${faNum(shown.seller_count)} فروشنده` : shown?.seller || <span className="text-muted">—</span>}
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    {shown ? (shown.in_stock === false ? <span className="text-bad">ناموجود</span> : shown.in_stock ? <span className="text-good">موجود</span> : "—") : "—"}
                  </td>
                  <td className="whitespace-nowrap">
                    {shown?.url ? <a href={shown.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">مشاهده</a> : <span className="text-muted">—</span>}
                  </td>
                  <td className="whitespace-nowrap text-sm text-muted">
                    {fresh ? (
                      <span title={formatDateTime(live!.checked_at ?? now)}>همین الان</span>
                    ) : l ? (
                      <span title={formatDateTime(l.checked_at)}>{timeAgo(l.checked_at, now)}</span>
                    ) : "—"}
                  </td>
                  <td className="whitespace-nowrap text-end">
                    <div className="flex justify-end gap-1">
                      {fresh && live!.url && live!.match !== "pinned" && (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => pin(site, live!.url!)} title="از این به بعد مستقیم همین صفحه بررسی شود">
                          این کالای درست است
                        </button>
                      )}
                      {pinnedUrl && (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => pin(site, null)} title={pinnedUrl}>حذف لینک ثابت</button>
                      )}
                      {(failed || ext === "missing" || !fresh) && row.state !== "checking" && (
                        <a className="btn-ghost px-2 py-1 text-xs" href={pinnedUrl || searchUrl(site, term)} target="_blank" rel="noopener noreferrer">
                          جستجو در {SITE_INFO[site].label}
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** "۸٪ ارزان‌تر" (shop below our price: watch out) / "۵٪ گران‌تر" */
function VsOwn({ price, own }: { price: number; own: number }) {
  const pct = Math.round(((price - own) / own) * 100);
  if (pct === 0) return <span className="text-muted">برابر</span>;
  return pct < 0 ? (
    <span className="text-bad" title={`${formatToman(own - price)} ارزان‌تر از قیمت ما`}>{faNum(-pct)}٪ ارزان‌تر</span>
  ) : (
    <span className="text-good" title={`${formatToman(price - own)} گران‌تر از قیمت ما`}>{faNum(pct)}٪ گران‌تر</span>
  );
}
