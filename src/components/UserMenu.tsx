"use client";

import Link from "next/link";
import { apiFetch } from "@/lib/client";

export function UserMenu({ name }: { name: string }) {
  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href="/account" className="text-muted hover:text-fg" title="حساب کاربری">{name}</Link>
      <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">خروج</button>
    </div>
  );
}
