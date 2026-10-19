import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/products";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const product = await getProduct(u.company_id, Number((await params).id) || 0);
  if (!product) notFound();
  return (
    <div className="space-y-4">
      <ProductHeader product={product} admin={u.role === "admin"} />
    </div>
  );
}

export function ProductHeader({ product, admin }: { product: NonNullable<Awaited<ReturnType<typeof getProduct>>>; admin: boolean }) {
  return (
    <div className="card flex flex-wrap items-start gap-4 p-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold leading-relaxed">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>کد: {product.internal_code ? <span className="ltr font-medium text-fg">{product.internal_code}</span> : <span className="badge bg-warn-soft text-warn">بدون کد</span>}</span>
          {product.dup_code && <span className="badge bg-bad-soft text-bad">کد تکراری</span>}
          {product.inactive_at && <span className="badge bg-warn-soft text-warn">غیرفعال</span>}
          {product.model && <span>· مدل: <span className="ltr font-medium text-fg">{product.model}</span></span>}
          {product.search_term && <span>· عبارت جستجو: <span className="ltr font-medium text-fg">{product.search_term}</span></span>}
        </div>
      </div>
      {admin && <Link href={`/products/${product.id}/edit`} className="btn-ghost">ویرایش</Link>}
    </div>
  );
}
