import Link from "next/link";
import type { Product } from "@/lib/products";

export function ProductHeader({ product, admin }: { product: Product; admin: boolean }) {
  return (
    <div className="card flex flex-wrap items-start gap-4 p-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold leading-relaxed">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>کد: {product.internal_code ? <span className="ltr font-medium text-fg">{product.internal_code}</span> : <span className="badge bg-warn-soft text-warn">بدون کد</span>}</span>
          {product.dup_code && <span className="badge bg-bad-soft text-bad">کد تکراری</span>}
          {product.inactive_at && <span className="badge bg-warn-soft text-warn">غیرفعال</span>}
          {product.model && <span>مدل: <span className="ltr font-medium text-fg">{product.model}</span></span>}
          {product.brand && <span>برند: <span className="font-medium text-fg">{product.brand}</span></span>}
        </div>
      </div>
      {admin && <Link href={`/products/${product.id}/edit`} className="btn-ghost">ویرایش</Link>}
    </div>
  );
}
