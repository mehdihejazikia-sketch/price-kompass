"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { timeAgo } from "@/lib/format";

type U = { id: number; username: string; display_name: string; role: "admin" | "user"; active: boolean; last_login_at: string | null };

export default function UsersClient({ meId }: { meId: number }) {
  const [users, setUsers] = useState<U[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => apiFetch<{ users: U[] }>("/api/users").then((d) => setUsers(d.users)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    try {
      await apiFetch("/api/users", { method: "POST", json: f });
      form.reset();
      setMsg({ ok: true, text: `کاربر «${f.username}» ساخته شد.` });
      load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  async function patch(id: number, data: Record<string, unknown>, ok: string) {
    try {
      await apiFetch("/api/users", { method: "PATCH", json: { id, ...data } });
      setMsg({ ok: true, text: ok });
      load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="card overflow-hidden">
        <h1 className="border-b border-border px-4 py-3 text-lg font-bold">کاربران</h1>
        <table className="table">
          <thead>
            <tr><th>نام کاربری</th><th>نام</th><th>نقش</th><th>آخرین ورود</th><th>وضعیت</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="ltr text-start font-medium">{u.username}</td>
                <td>{u.display_name}</td>
                <td>{u.role === "admin" ? "مدیر" : "کاربر"}</td>
                <td className="text-muted">{u.last_login_at ? timeAgo(u.last_login_at) : "—"}</td>
                <td>{u.active ? <span className="badge bg-good-soft text-good">فعال</span> : <span className="badge bg-bad-soft text-bad">غیرفعال</span>}</td>
                <td className="whitespace-nowrap text-end">
                  {u.id !== meId && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => patch(u.id, { active: !u.active }, u.active ? "کاربر غیرفعال شد." : "کاربر فعال شد.")}>
                      {u.active ? "غیرفعال کردن" : "فعال کردن"}
                    </button>
                  )}{" "}
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => {
                      const p = prompt(`رمز جدید برای ${u.username} (حداقل ۸ کاراکتر):`);
                      if (p) patch(u.id, { password: p }, "رمز عبور تغییر کرد.");
                    }}
                  >
                    تغییر رمز
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card h-fit p-4">
        <h2 className="mb-4 font-bold">کاربر جدید</h2>
        <form onSubmit={create} className="space-y-3">
          <div><label className="label">نام کاربری (انگلیسی)</label><input name="username" className="input ltr text-left" required /></div>
          <div><label className="label">نام نمایشی</label><input name="display_name" className="input" /></div>
          <div><label className="label">رمز عبور</label><input name="password" type="text" className="input ltr text-left" minLength={8} required /></div>
          <div>
            <label className="label">نقش</label>
            <select name="role" className="input">
              <option value="user">کاربر (جستجو و تاریخچه)</option>
              <option value="admin">مدیر (کاربران و کالاها)</option>
            </select>
          </div>
          <button className="btn-primary w-full">ساخت کاربر</button>
        </form>
        {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
