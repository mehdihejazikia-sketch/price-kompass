import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { UpdateNotice } from "@/components/UpdateNotice";
import { InstallApp } from "@/components/InstallApp";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Logo />
            <span className="text-lg">قیمت‌یاب</span>
          </Link>
          <Nav admin={user.role === "admin"} />
          <div className="ms-auto flex items-center gap-2">
            <InstallApp />
            <ThemeToggle />
            <UserMenu name={user.display_name || user.username} />
          </div>
        </div>
      </header>
      <UpdateNotice />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">{children}</main>
      <footer className="py-4 text-center text-xs text-muted">
        قیمت‌یاب · {user.company_name}
      </footer>
    </div>
  );
}
