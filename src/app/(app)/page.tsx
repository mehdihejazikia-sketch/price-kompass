import { requireUser } from "@/lib/server/auth";

export default async function Home() {
  const u = await requireUser();
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-bold">سلام {u.display_name || u.username}</h1>
      <p className="mt-2 text-muted">جستجوی کالا در مرحله بعد اضافه می‌شود.</p>
    </div>
  );
}
