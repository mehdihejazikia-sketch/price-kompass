import { requireUser } from "@/lib/server/auth";
import ProductsClient from "./ProductsClient";

export const metadata = { title: "کالاها" };

export default async function ProductsPage() {
  const u = await requireUser();
  return <ProductsClient admin={u.role === "admin"} />;
}
