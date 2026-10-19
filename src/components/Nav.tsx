"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "جستجو" },
    { href: "/products", label: "کالاها" },
    ...(admin ? [{ href: "/import", label: "ورود از اکسل" }] : []),
    { href: "/history", label: "تاریخچه قیمت" },
    ...(admin ? [{ href: "/users", label: "کاربران" }] : []),
    { href: "/extension", label: "افزونه" },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-row hover:text-fg"}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
