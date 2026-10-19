"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";

export default function AccountForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (f.password !== f.repeat) return setMsg({ ok: false, text: "تکرار رمز جدید یکسان نیست." });
    try {
      await apiFetch("/api/account", { method: "POST", json: { current: f.current, password: f.password } });
      form.reset();
      setMsg({ ok: true, text: "رمز عبور تغییر کرد." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h2 className="font-bold">تغییر رمز عبور</h2>
      <div><label className="label">رمز فعلی</label><input name="current" type="password" className="input ltr" required autoComplete="current-password" /></div>
      <div><label className="label">رمز جدید</label><input name="password" type="password" className="input ltr" minLength={8} required autoComplete="new-password" /></div>
      <div><label className="label">تکرار رمز جدید</label><input name="repeat" type="password" className="input ltr" minLength={8} required autoComplete="new-password" /></div>
      <button className="btn-primary w-full">ذخیره</button>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{msg.text}</p>}
    </form>
  );
}
