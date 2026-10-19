"use client";

import { useEffect, useState } from "react";
import { EXTENSION_VERSION, pingExtension, type ExtensionInfo } from "@/lib/sources/extension";
import { faDigits } from "@/lib/format";

export function ExtensionStatus() {
  const [info, setInfo] = useState<ExtensionInfo | null>(null);
  useEffect(() => {
    pingExtension().then(setInfo);
  }, []);
  if (!info) return <p className="text-sm text-muted">در حال بررسی وضعیت افزونه…</p>;
  if (!info.installed)
    return (
      <p className="rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn" data-testid="ext-status">
        افزونه روی این مرورگر نصب نیست (یا برای این آدرس فعال نیست). مراحل زیر را انجام دهید.
      </p>
    );
  const old = EXTENSION_VERSION && info.version !== EXTENSION_VERSION;
  return (
    <p className={`rounded-lg px-4 py-3 text-sm ${old ? "bg-warn-soft text-warn" : "bg-good-soft text-good"}`} data-testid="ext-status">
      ● افزونه نصب و فعال است (نسخه {faDigits(info.version ?? "")}).
      {old && <> نسخه جدید ({faDigits(EXTENSION_VERSION)}) آماده است؛ فایل را دوباره دانلود و جایگزین کنید.</>}
    </p>
  );
}
