import { requireAdminPage } from "@/lib/server/auth";
import { ProductForm } from "@/components/ProductForm";

export const metadata = { title: "کالای جدید" };

export default async function NewProduct() {
  await requireAdminPage();
  return <ProductForm />;
}
