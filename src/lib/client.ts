"use client";

/** fetch JSON from our own API; throws Error with the Farsi message. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.href = "/login?next=" + encodeURIComponent(location.pathname);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "خطا در ارتباط با سرور");
  return data as T;
}
