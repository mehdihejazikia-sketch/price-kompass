import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/products";
import { lastKnown, priceHistory } from "@/lib/server/prices";
import { serverSourceInfo } from "@/lib/server/sources";
import { ProductHeader } from "@/components/ProductHeader";
import { ProductPrices } from "@/components/ProductPrices";
import { SearchBox } from "@/components/SearchBox";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `کالا ${(await params).id}` };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id) || 0;
  const product = await getProduct(u.company_id, id);
  if (!product) notFound();
  const [last, history] = await Promise.all([lastKnown(u.company_id, id), priceHistory(u.company_id, id)]);
  return (
    <div className="space-y-4">
      <div className="max-w-xl"><SearchBox autoFocus={false} compact /></div>
      <ProductHeader product={product} admin={u.role === "admin"} />
      <ProductPrices
        key={product.id}
        product={{
          id: product.id,
          name: product.name,
          model: product.model,
          brand: product.brand,
          search_term: product.search_term,
          urls: { torob: product.url_torob, digikala: product.url_digikala, emalls: product.url_emalls },
        }}
        initialLast={JSON.parse(JSON.stringify(last))}
        initialHistory={JSON.parse(JSON.stringify(history))}
        serverSources={serverSourceInfo()}
      />
    </div>
  );
}
