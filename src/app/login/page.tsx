import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { Logo } from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "ورود" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await currentUser()) redirect(safeNext);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={52} />
          <h1 className="text-2xl font-bold">قیمت‌یاب</h1>
          <p className="text-sm text-muted">استعلام قیمت از ترب، دیجی‌کالا و ایمالز</p>
        </div>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
