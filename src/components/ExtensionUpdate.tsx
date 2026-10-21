"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { EXTENSION_VERSION, pingExtension } from "@/lib/sources/extension";
import { compareVersions } from "@/lib/version";
import { faDigits } from "@/lib/format";

const SNOOZE_KEY = "pk-ext-update-snooze";

/**
 * Users don't notice new extension versions by themselves. When the installed
 * extension is older than the one this deploy ships, show a window with the
 * download and the 3 update steps (again each day until updated), plus a small
 * «به‌روزرسانی افزونه» button in the header that reopens it.
 */
export function ExtensionUpdate() {
  const [installed, setInstalled] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    pingExtension().then((info) => {
      if (!alive || !info.installed || !info.version || !EXTENSION_VERSION) return;
      if (compareVersions(info.version, EXTENSION_VERSION) >= 0) return;
      setInstalled(info.version);
      let snoozed = false;
      try {
        const s = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null");
        snoozed = s?.version === EXTENSION_VERSION && s.until > Date.now();
      } catch {}
      if (!snoozed) setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && later();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify({ version: EXTENSION_VERSION, until: Date.now() + 24 * 3600 * 1000 }));
    } catch {}
    setOpen(false);
  }

  if (!installed) return null;
  return (
    <>
      <button className="btn px-3 py-1.5 text-xs bg-warn-soft text-warn hover:opacity-90" onClick={() => setOpen(true)} data-testid="ext-update-chip">
        به‌روزرسانی افزونه
      </button>
      {open && createPortal(
        // rendered on <body>: the sticky header (backdrop-blur) would trap a fixed element
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={later}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ext-update-title"
            className="card w-full max-w-lg space-y-4 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="ext-update-dialog"
          >
            <h2 id="ext-update-title" className="text-lg font-bold">نسخه جدید افزونه قیمت‌یاب آماده است</h2>
            <p className="text-sm leading-loose text-muted">
              افزونه نصب‌شده روی این مرورگر نسخه <b className="text-fg">{faDigits(installed)}</b> است و نسخه جدید{" "}
              <b className="text-fg">{faDigits(EXTENSION_VERSION)}</b> است. نسخه جدید قیمت‌ها را دقیق‌تر و کامل‌تر پیدا می‌کند؛ برای بهترین نتیجه آن را به‌روز کنید (حدود یک دقیقه).
            </p>
            <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed">
              <li>«دانلود نسخه جدید» را بزنید.</li>
              <li>فایل zip را باز کنید و فایل‌ها را در <b>همان پوشه قبلی افزونه</b> جایگزین کنید.</li>
              <li>
                در <code className="ltr rounded bg-row px-1.5">edge://extensions</code> روی دکمه بارگذاری مجدد (↻) افزونه قیمت‌یاب بزنید و این صفحه را دوباره باز کنید.
              </li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a href="/api/extension/download" className="btn-primary">دانلود نسخه جدید</a>
              <Link href="/extension" className="btn-ghost" onClick={() => setOpen(false)}>راهنمای کامل</Link>
              <button className="btn-ghost ms-auto" onClick={later}>بعداً</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
