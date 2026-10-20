import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { getProduct, lastPriceImport } from "@/lib/server/products";
import { SystemPrices } from "@/components/SystemPrices";
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
  const [last, history, priceFile] = await Promise.all([lastKnown(u.company_id, id), priceHistory(u.company_id, id), lastPriceImport(u.company_id)]);
  return (
    <div className="space-y-4">
      <div className="max-w-xl"><SearchBox autoFocus={false} compact /></div>
      <ProductHeader product={product} admin={u.role === "admin"} />
      <SystemPrices
        level1={product.price_level1}
        level2={product.price_level2}
        updatedAt={product.prices_updated_at ? String(product.prices_updated_at) : null}
        fileDate={priceFile?.file_date ?? null}
      />
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
        ownPrice={product.price_level1}
      />
    </div>
  );
}
