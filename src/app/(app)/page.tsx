import { requireUser } from "@/lib/server/auth";
import { SearchBox } from "@/components/SearchBox";

export default async function Home() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-[8vh]">
      <div className="text-center">
        <h1 className="text-2xl font-bold">استعلام قیمت کالا</h1>
        <p className="mt-2 text-muted">قیمت لحظه‌ای در ترب، دیجی‌کالا و ایمالز</p>
      </div>
      <SearchBox />
      <p className="text-center text-xs text-muted">
        <kbd>↑</kbd> <kbd>↓</kbd> انتخاب · <kbd>Enter</kbd> باز کردن · <kbd>Esc</kbd> پاک کردن
      </p>
    </div>
  );
}
