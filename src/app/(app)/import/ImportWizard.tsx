"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { faNum, formatDateTime } from "@/lib/format";
import { CHANGE_LABELS, categoryOf, diffProducts, type Category, type ExistingProduct, type Entry } from "@/lib/importDiff";
import { FIELD_LABELS, PRODUCT_FIELDS } from "@/lib/products";
import {
  autoMap, columnLetter, detectFormat, formatFromMapping, guessHeaderRow, mappedRows, providedFields, readWorkbook,
  type ImportFormat, type Mapping, type Sheet,
} from "@/lib/sheet";

type LogRow = { id: number; file_name: string; status: string; row_count: number; counts: Record<string, number> | null; created_at: string; finished_at: string | null; undone_at: string | null; username: string | null };
type Result = Record<string, number>;
type Filter = Category | "missing" | "no_code" | "dup_code" | "invalid" | "all";

const BATCH = 1000;
const PAGE = 200;

export default function ImportWizard() {
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [existing, setExisting] = useState<ExistingProduct[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<Mapping | null>(null);
  const [manual, setManual] = useState(false);
  const [saveFormat, setSaveFormat] = useState(true);
  const [missingMode, setMissingMode] = useState<"deactivate" | "delete">("deactivate");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loaded = useRef<Promise<ImportFormat> | null>(null);
  const load = useCallback(() => {
    const p = apiFetch<{ format: ImportFormat; existing: ExistingProduct[]; log: LogRow[] }>("/api/import").then((d) => {
      setFormat(d.format);
      setExisting(d.existing);
      setLog(d.log);
      return d.format;
    });
    loaded.current = p;
    return p;
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const sheet = sheets[sheetIdx];
  const headers = sheet?.rows[headerRow] ?? [];
  const dataRows = useMemo(() => (sheet ? sheet.rows.slice(headerRow + 1) : []), [sheet, headerRow]);
  const inputs = useMemo(() => (map ? mappedRows(dataRows, map) : []), [dataRows, map]);
  const provided = useMemo(() => (map ? providedFields(map) : []), [map]);
  const ready = !!map && map.name >= 0 && !manual;
  const diff = useMemo(() => (ready ? diffProducts(inputs, existing, provided) : null), [ready, inputs, existing, provided]);

  async function onFile(file: File | undefined) {
    if (!file || !loaded.current) return;
    const format = await loaded.current; // a file chosen before the page finished loading
    setError("");
    setResult(null);
    setFilter("all");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError("فقط فایل‌های ‎.xlsx، ‎.xls و ‎.csv پذیرفته می‌شوند.");
    setBusy("در حال خواندن فایل…");
    try {
      const list = await readWorkbook(file);
      if (!list.length) throw new Error("فایل خالی است.");
      setFileName(file.name);
      setSheets(list);
      // the saved format, on whichever sheet has it
      for (let i = 0; i < list.length; i++) {
        const found = detectFormat(list[i].rows, format);
        if (found) {
          setSheetIdx(i);
          setHeaderRow(found.headerRow);
          setMap(found.map);
          setManual(false);
          return;
        }
      }
      // fallback: manual column mapping
      const h = guessHeaderRow(list[0].rows);
      setSheetIdx(0);
      setHeaderRow(h);
      setMap(autoMap(list[0].rows[h] ?? []));
      setManual(true);
    } catch (e) {
      setError("خواندن فایل ممکن نشد: " + (e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function apply() {
    if (!diff || !map) return;
    if (missingMode === "delete" && diff.counts.missing > 0 && !confirm(`${faNum(diff.counts.missing)} کالا که در این فایل نیستند حذف می‌شوند. ادامه می‌دهید؟`)) return;
    setError("");
    try {
      setBusy("شروع…");
      const { importId } = await apiFetch<{ importId: number }>("/api/import/start", { method: "POST", json: { fileName, missingMode } });
      for (let off = 0; off < inputs.length; off += BATCH) {
        setBusy(`ارسال ردیف‌ها: ${faNum(Math.min(off + BATCH, inputs.length))} از ${faNum(inputs.length)}`);
        await apiFetch("/api/import/rows", { method: "POST", json: { importId, offset: off, rows: inputs.slice(off, off + BATCH) } });
      }
      setBusy("ثبت در فهرست کالاها…");
      const r = await apiFetch<Result>("/api/import/finish", {
        method: "POST",
        json: { importId, provided, expectedRows: inputs.length, saveFormat: saveFormatNow ? formatFromMapping(headers, map) : undefined },
      });
      setResult(r);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function undo(id: number) {
    if (!confirm("آخرین ورود اکسل بازگردانی شود؟ کالاهای اضافه‌شده حذف و تغییرات به حالت قبل برمی‌گردند.")) return;
    setBusy("بازگردانی…");
    try {
      await apiFetch("/api/import/undo", { method: "POST", json: { importId: id } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setSheets([]);
    setFileName("");
    setMap(null);
    setManual(false);
    setResult(null);
    setMissingMode("deactivate");
    if (inputRef.current) inputRef.current.value = "";
  }

  // a manual mapping is saved as the new default when the admin wants it
  const [usedManual, setUsedManual] = useState(false);
  const saveFormatNow = usedManual && saveFormat;
  const lastDone = log.find((l) => l.status === "done");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">ورود کالا از اکسل</h1>
        {format && (
          <p className="text-sm text-muted">
            قالب پیش‌فرض: {PRODUCT_FIELDS.filter((f) => format[f]).slice(0, 3).map((f) => `«${format[f]}»`).join("، ")}
          </p>
        )}
      </div>

      {error && <p className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad" role="status">{error}</p>}
      {busy && <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent" role="status">{busy}</p>}

      {result ? (
        <div className="card space-y-4 p-6" data-testid="import-result">
          <h2 className="text-lg font-bold text-good">فهرست کالاها به‌روز شد</h2>
          <Tiles
            items={[
              ["جدید", result.new, "text-good"],
              ["نام تغییر کرده", result.name_changed, "text-accent"],
              ["تغییرات دیگر", result.other_changed, "text-accent"],
              ["بدون تغییر", result.unchanged, "text-muted"],
              [result.deleted ? "حذف شده" : "غیرفعال شده", result.deactivated + result.deleted, "text-warn"],
              ["رد شده (خطا)", result.invalid, result.invalid ? "text-bad" : "text-muted"],
            ]}
          />
          <div className="flex gap-2">
            <Link href="/products" className="btn-primary">مشاهده کالاها</Link>
            <button className="btn-ghost" onClick={reset}>ورود فایل دیگر</button>
          </div>
        </div>
      ) : (
        <>
          {!sheets.length && (
            <div
              className={`card flex flex-col items-center gap-3 border-2 border-dashed p-10 text-center transition-colors ${drag ? "border-accent bg-accent-soft" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
            >
              <p className="text-muted">فایل خروجی حسابداری (اکسل یا CSV) را اینجا رها کنید یا</p>
              <label className="btn-primary cursor-pointer">
                انتخاب فایل
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="file-input" />
              </label>
              <p className="text-xs text-muted">ستون‌ها: «نام کالا»، «کد کالا»، «ردیف». ستون‌های اضافه (مدل، عبارت جستجو) اختیاری‌اند.</p>
            </div>
          )}

          {sheets.length > 0 && map && manual && (
            <div className="card space-y-4 p-5">
              <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                ستون‌های قالب پیش‌فرض («{format?.name}»، «{format?.internal_code}») در این فایل پیدا نشد. ستون‌ها را دستی مشخص کنید.
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {sheets.length > 1 && (
                  <div>
                    <label className="label">برگه (Sheet)</label>
                    <select className="input w-56" value={sheetIdx} onChange={(e) => { const i = Number(e.target.value); setSheetIdx(i); const h = guessHeaderRow(sheets[i].rows); setHeaderRow(h); setMap(autoMap(sheets[i].rows[h] ?? [])); }}>
                      {sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({faNum(s.rows.length)} ردیف)</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">ردیف عنوان ستون‌ها</label>
                  <select className="input w-40" value={headerRow} onChange={(e) => { const h = Number(e.target.value); setHeaderRow(h); setMap(autoMap(sheet.rows[h] ?? [])); }}>
                    {sheet.rows.slice(0, 30).map((_, i) => <option key={i} value={i}>ردیف {faNum(i + 1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {PRODUCT_FIELDS.map((f) => (
                  <div key={f}>
                    <label className="label">{FIELD_LABELS[f]} {f === "name" && <span className="text-bad">*</span>}</label>
                    <select className="input" value={map[f]} aria-label={FIELD_LABELS[f]} onChange={(e) => setMap({ ...map, [f]: Number(e.target.value) } as Mapping)}>
                      <option value={-1}>— ندارد —</option>
                      {headers.map((h, i) => <option key={i} value={i}>ستون {columnLetter(i)}: {h || "(بدون عنوان)"}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveFormat} onChange={(e) => setSaveFormat(e.target.checked)} />
                این ستون‌ها قالب پیش‌فرض شوند (دفعه بعد بدون این مرحله)
              </label>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={map.name < 0} onClick={() => { setManual(false); setUsedManual(true); }}>ادامه به پیش‌نمایش</button>
                <button className="btn-ghost" onClick={reset}>انصراف</button>
              </div>
            </div>
          )}

          {diff && (
            <div className="card overflow-hidden" data-testid="import-preview">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="font-bold">
                  پیش‌نمایش تغییرات <span className="ltr text-sm font-normal text-muted">{fileName}</span>
                </h2>
                <span className="text-sm text-muted">{faNum(diff.counts.total)} کالا در فایل</span>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {([
                  ["all", "همه", diff.counts.total, ""],
                  ["new", "جدید", diff.counts.new, "text-good"],
                  ["name_changed", "نام تغییر کرده", diff.counts.name_changed, "text-accent"],
                  ["other_changed", "تغییرات دیگر", diff.counts.other_changed, "text-accent"],
                  ["unchanged", "بدون تغییر", diff.counts.unchanged, "text-muted"],
                  ["missing", "در فایل نیست", diff.counts.missing, "text-warn"],
                  ["no_code", "بدون کد", diff.counts.no_code, "text-warn"],
                  ["dup_code", `کد تکراری (${faNum(diff.counts.dup_codes)} کد)`, diff.counts.dup_code_rows, "text-bad"],
                  ...(diff.counts.invalid ? [["invalid", "خطا", diff.counts.invalid, "text-bad"]] : []),
                ] as [Filter, string, number, string][]).map(([k, label, n, cls]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    data-testid={`count-${k}`}
                    className={`min-w-24 rounded-lg border px-3 py-2 text-start transition-colors ${filter === k ? "border-accent bg-accent-soft" : "border-border hover:bg-row"}`}
                  >
                    <div className={`text-xl font-bold ${cls}`}>{faNum(n)}</div>
                    <div className="text-xs text-muted">{label}</div>
                  </button>
                ))}
              </div>
              <DiffTable diff={diff} filter={filter} headerRow={headerRow} />
              <div className="space-y-3 border-t border-border p-4">
                {diff.counts.missing > 0 && (
                  <fieldset className="space-y-1 text-sm">
                    <legend className="mb-1 font-medium">{faNum(diff.counts.missing)} کالای فعلی در این فایل نیست:</legend>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="missing" checked={missingMode === "deactivate"} onChange={() => setMissingMode("deactivate")} />
                      «غیرفعال» شوند (از جستجو پنهان، تاریخچه حفظ می‌شود) <span className="text-muted">(پیشنهادی)</span>
                    </label>
                    <label className="flex items-center gap-2 text-bad">
                      <input type="radio" name="missing" checked={missingMode === "delete"} onChange={() => setMissingMode("delete")} />
                      حذف شوند (تاریخچه قیمت در پایگاه داده می‌ماند)
                    </label>
                  </fieldset>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={apply} disabled={!!busy}>ثبت در فهرست کالاها</button>
                  <button className="btn-ghost" onClick={reset} disabled={!!busy}>انصراف</button>
                  {!usedManual && (
                    <button className="btn-ghost ms-auto text-xs" onClick={() => setManual(true)} disabled={!!busy}>تطبیق دستی ستون‌ها</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-4 py-3 font-bold">سابقه ورود اکسل</h2>
        {log.length === 0 ? (
          <p className="p-4 text-sm text-muted">هنوز فایلی وارد نشده است.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>تاریخ</th><th>کاربر</th><th>فایل</th><th>ردیف</th><th>جدید</th><th>تغییر نام</th><th>غیرفعال/حذف</th><th>وضعیت</th><th></th></tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.finished_at ?? l.created_at)}</td>
                  <td>{l.username}</td>
                  <td className="ltr max-w-56 truncate text-start">{l.file_name}</td>
                  <td>{faNum(l.row_count)}</td>
                  <td>{faNum(l.counts?.new ?? 0)}</td>
                  <td>{faNum(l.counts?.name_changed ?? 0)}</td>
                  <td>{faNum((l.counts?.deactivated ?? 0) + (l.counts?.deleted ?? 0))}</td>
                  <td>{l.status === "undone" ? <span className="badge bg-warn-soft text-warn">بازگردانی شد</span> : <span className="badge bg-good-soft text-good">انجام شد</span>}</td>
                  <td>{lastDone?.id === l.id && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => undo(l.id)} disabled={!!busy}>بازگردانی</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Tiles({ items }: { items: [string, number, string][] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(([label, n, cls]) => (
        <div key={label} className="min-w-28 rounded-lg border border-border px-4 py-2">
          <div className={`text-2xl font-bold ${cls}`}>{faNum(n ?? 0)}</div>
          <div className="text-xs text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

const CAT_BADGE: Record<Category, [string, string]> = {
  new: ["جدید", "bg-good-soft text-good"],
  name_changed: ["نام تغییر کرده", "bg-accent-soft text-accent"],
  other_changed: ["تغییر", "bg-accent-soft text-accent"],
  unchanged: ["بدون تغییر", "bg-row text-muted"],
};

function DiffTable({ diff, filter, headerRow }: { diff: NonNullable<ReturnType<typeof diffProducts>>; filter: Filter; headerRow: number }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filter]);
  if (filter === "missing") {
    const list = diff.missing;
    return (
      <div className="max-h-[480px] overflow-auto border-t border-border">
        <table className="table">
          <thead className="sticky top-0 bg-card"><tr><th>نام کالا</th><th>کد کالا</th><th>وضعیت</th></tr></thead>
          <tbody>
            {list.slice(0, page * PAGE).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td className="ltr text-start">{p.internal_code || "—"}</td><td><span className="badge bg-warn-soft text-warn">در فایل نیست</span></td></tr>
            ))}
          </tbody>
        </table>
        {list.length > page * PAGE && <More n={list.length - page * PAGE} onClick={() => setPage(page + 1)} />}
      </div>
    );
  }
  if (filter === "invalid") {
    return (
      <ul className="max-h-[480px] overflow-auto border-t border-border p-4 text-sm text-bad">
        {diff.invalid.map((r) => <li key={r.idx}>ردیف {faNum(headerRow + 2 + r.idx)} {r.code && `(کد ${r.code})`}: {r.reason}</li>)}
      </ul>
    );
  }
  const rows: Entry[] = diff.entries.filter((e) =>
    filter === "all" ? true
      : filter === "no_code" ? !e.row.code_norm
      : filter === "dup_code" ? diff.dupCodes.has(e.row.code_norm)
      : categoryOf(e) === filter,
  );
  const sorted = filter === "dup_code" ? [...rows].sort((a, b) => a.row.code_norm.localeCompare(b.row.code_norm)) : rows;
  return (
    <div className="max-h-[480px] overflow-auto border-t border-border">
      <table className="table">
        <thead className="sticky top-0 z-10 bg-card"><tr><th>ردیف</th><th>نام کالا</th><th>کد کالا</th><th>مدل</th><th>وضعیت</th></tr></thead>
        <tbody>
          {sorted.slice(0, page * PAGE).map((e) => {
            const cat = categoryOf(e);
            return (
              <tr key={e.row.idx}>
                <td className="text-muted">{faNum(headerRow + 2 + e.row.idx)}</td>
                <td>
                  {e.final.name}
                  {e.kind === "match" && e.changes.includes("name") && <div className="text-xs text-muted line-through">{e.existing.name}</div>}
                </td>
                <td className="ltr whitespace-nowrap text-start">{e.final.internal_code || <span className="text-muted">—</span>}</td>
                <td className="ltr text-start text-muted">{e.final.model}</td>
                <td className="space-x-1 space-x-reverse whitespace-nowrap">
                  <span className={`badge ${CAT_BADGE[cat][1]}`}>{CAT_BADGE[cat][0]}</span>
                  {e.kind === "match" && cat === "other_changed" && <span className="text-xs text-muted">{e.changes.filter((c) => c !== "sort").map((c) => CHANGE_LABELS[c]).join("، ")}</span>}
                  {!e.row.code_norm && <span className="badge bg-warn-soft text-warn">بدون کد</span>}
                  {diff.dupCodes.has(e.row.code_norm) && <span className="badge bg-bad-soft text-bad">کد تکراری</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > page * PAGE && <More n={sorted.length - page * PAGE} onClick={() => setPage(page + 1)} />}
    </div>
  );
}

function More({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <div className="p-3 text-center">
      <button className="btn-ghost text-xs" onClick={onClick}>نمایش بیشتر ({faNum(n)} ردیف دیگر)</button>
    </div>
  );
}

