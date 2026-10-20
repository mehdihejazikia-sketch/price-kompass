"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { formatToman } from "@/lib/format";

type Hit = { id: number; internal_code: string; name: string; model: string; price_level1: number | null; exact: boolean };

/**
 * Focused on load. Typing shows suggestions; ↑/↓ choose, Enter opens,
 * Esc clears. An exact internal code opens that product directly.
 */
export function SearchBox({ autoFocus = true, compact = false }: { autoFocus?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setSearched("");
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await apiFetch<{ results: Hit[] }>(`/api/search?q=${encodeURIComponent(term)}`);
        if (my !== seq.current) return;
        setHits(results);
        setActive(0);
        setOpen(true);
        setSearched(term);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  function go(h: Hit | undefined) {
    if (!h) return;
    setOpen(false);
    router.push(`/products/${h.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // results for what is typed now; if they're still loading, wait briefly
      if (searched === q.trim()) go(hits[active]);
      else setTimeout(() => go(hits[0]), 250);
    } else if (e.key === "Escape") {
      setQ("");
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="نام کالا، مدل یا کد کالا را بنویسید…"
        aria-label="جستجوی کالا"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        autoComplete="off"
        className={`input ${compact ? "py-2" : "py-4 text-lg"} pe-12 shadow-sm`}
      />
      <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted">{loading ? "…" : "⌕"}</span>
      {open && q.trim() && searched && (
        <ul id="search-results" role="listbox" className="card absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-auto py-1 shadow-lg">
          {hits.length === 0 && <li className="px-4 py-3 text-sm text-muted">کالایی با «{searched}» پیدا نشد.</li>}
          {hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(h); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? "bg-accent-soft" : ""}`}
            >
              <span className="flex-1">{h.name}</span>
              {h.model && <span className="ltr text-xs text-muted">{h.model}</span>}
              {h.price_level1 ? <span className="text-xs font-medium">{formatToman(h.price_level1)}</span> : null}
              <span className={`ltr min-w-16 text-end text-sm ${h.exact ? "font-bold text-accent" : "text-muted"}`}>{h.internal_code || "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
