"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const LABEL: Record<Mode, string> = { system: "خودکار", light: "روشن", dark: "تیره" };
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      setMode((localStorage.getItem("pk-theme") as Mode) || "system");
    } catch {}
  }, []);
  function toggle() {
    const m = NEXT[mode];
    setMode(m);
    try {
      if (m === "system") localStorage.removeItem("pk-theme");
      else localStorage.setItem("pk-theme", m);
    } catch {}
    apply(m);
  }
  return (
    <button onClick={toggle} className="btn-ghost px-3 py-1.5 text-xs" title="تغییر حالت نمایش">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {mode === "dark" ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : mode === "light" ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
        ) : (
          <><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" /></>
        )}
      </svg>
      {LABEL[mode]}
    </button>
  );
}
