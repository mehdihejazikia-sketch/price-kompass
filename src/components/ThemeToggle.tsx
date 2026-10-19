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
      {mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐"} {LABEL[mode]}
    </button>
  );
}
