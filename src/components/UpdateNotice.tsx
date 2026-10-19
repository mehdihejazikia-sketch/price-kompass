"use client";

import { useEffect, useState } from "react";

// Every push to main deploys a new build. Open tabs check every 10 minutes
// (and when they come back to the foreground) and offer a reload.
export function UpdateNotice() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    async function check() {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build } = await r.json();
        if (build && mine && build !== mine) setFresh(true);
      } catch {}
    }
    const t = setInterval(check, 10 * 60 * 1000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  if (!fresh) return null;
  return (
    <div className="bg-accent-soft px-4 py-2 text-center text-sm text-accent">
      نسخه جدید قیمت‌یاب آماده است.{" "}
      <button className="font-bold underline" onClick={() => location.reload()}>بارگذاری مجدد</button>
    </div>
  );
}
