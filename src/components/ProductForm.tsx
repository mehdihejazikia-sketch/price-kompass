"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { extractModel, defaultSearchTerm } from "@/lib/model";
import { FIELD_LABELS, type Product } from "@/lib/products";
import { SITES, SITE_INFO } from "@/lib/sites";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [v, setV] = useState({
    internal_code: product?.internal_code ?? "",
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    model: product?.model ?? "",
    search_term: product?.search_term ?? "",
    url_torob: product?.url_torob ?? "",
    url_digikala: product?.url_digikala ?? "",
    url_emalls: product?.url_emalls ?? "",
    url_hooshmand: product?.url_hooshmand ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { product: saved } = await apiFetch<{ product: Product }>(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PUT" : "POST",
        json: v,
      });
      router.push(`/products/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!product || !confirm("این کالا حذف شود؟ تاریخچه قیمت آن در پایگاه داده حفظ می‌شود.")) return;
    await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
    router.push("/products");
    router.refresh();
  }

  const autoModel = extractModel(v.name);
  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-bold">{product ? "ویرایش کالا" : "کالای جدید"}</h1>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div><label className="label" htmlFor="f-name">{FIELD_LABELS.name} *</label><input className="input" id="f-name" value={v.name} onChange={set("name")} required autoFocus={!product} /></div>
        <div><label className="label" htmlFor="f-internal_code">{FIELD_LABELS.internal_code}</label><input className="input ltr text-left" id="f-internal_code" value={v.internal_code} onChange={set("internal_code")} placeholder="مثلاً 88724" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="f-brand">{FIELD_LABELS.brand}</label><input className="input" id="f-brand" value={v.brand} onChange={set("brand")} /></div>
        <div>
          <label className="label" htmlFor="f-model">{FIELD_LABELS.model}</label>
          <div className="flex gap-2">
            <input className="input ltr text-left" id="f-model" value={v.model} onChange={set("model")} placeholder={autoModel} />
            {autoModel && autoModel !== v.model && (
              <button type="button" className="btn-ghost shrink-0 px-2 text-xs" onClick={() => setV({ ...v, model: autoModel })} title="استخراج از نام">از نام</button>
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-search_term">{FIELD_LABELS.search_term}</label>
          <input className="input ltr text-left" id="f-search_term" value={v.search_term} onChange={set("search_term")} placeholder={defaultSearchTerm(v.name, v.model)} />
        </div>
      </div>
      <p className="text-xs text-muted">عبارت جستجو همان چیزی است که در دیجی‌کالا، ترب، ایمالز و هوشمند جستجو می‌شود. اگر خالی باشد، مدل یا نام کالا استفاده می‌شود.</p>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">لینک ثابت کالا در هر سایت (اختیاری)</legend>
        {SITES.map((s) => (
          <div key={s} className="grid items-center gap-2 sm:grid-cols-[110px_1fr]">
            <label className="text-sm text-muted" htmlFor={`url_${s}`}>{SITE_INFO[s].label}</label>
            <input id={`url_${s}`} className="input ltr text-left" value={v[`url_${s}`]} onChange={set(`url_${s}`)} placeholder={`${SITE_INFO[s].home}/…`} />
          </div>
        ))}
      </fieldset>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره"}</button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>انصراف</button>
        {product && <button type="button" className="btn-danger ms-auto" onClick={remove}>حذف کالا</button>}
      </div>
    </form>
  );
}
