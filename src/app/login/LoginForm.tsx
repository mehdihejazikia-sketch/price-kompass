"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";

export default function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: { username: f.get("username"), password: f.get("password") } });
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">نام کاربری</label>
        <input id="username" name="username" className="input ltr text-left" autoComplete="username" autoFocus required />
      </div>
      <div>
        <label className="label" htmlFor="password">رمز عبور</label>
        <input id="password" name="password" type="password" className="input ltr text-left" autoComplete="current-password" required />
      </div>
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "در حال ورود…" : "ورود"}</button>
    </form>
  );
}
