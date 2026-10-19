import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/products";
import { ProductForm } from "@/components/ProductForm";

export const metadata = { title: "ویرایش کالا" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireAdminPage();
  const product = await getProduct(u.company_id, Number((await params).id) || 0);
  if (!product) notFound();
  return <ProductForm product={product} />;
}
