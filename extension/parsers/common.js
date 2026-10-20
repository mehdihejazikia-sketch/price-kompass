// Shared helpers for the site parsers. Injected into the shop page (isolated
// world) before the site's own parser file. Every parser prefers structured
// data (JSON-LD, embedded Next.js JSON, the site's own JSON API) over CSS
// selectors, so a visual redesign rarely breaks it.
(() => {
  if (globalThis.__pk) return;

  const DIGITS = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };

  const toLatin = (s) => String(s ?? "").replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);

  /** "۱۲٬۵۰۰٬۰۰۰" / "12,500,000" / 12500000 → 12500000 (null if no number). */
  function parseNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
    const t = toLatin(v).replace(/[٬,،\s٫٬.]/g, "");
    const m = t.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Poll until fn() returns something truthy (or the timeout passes). */
  async function waitFor(fn, timeout = 12000, every = 300) {
    const end = Date.now() + timeout;
    for (;;) {
      if (blockedReason()) return null; // captcha page: stop waiting
      try {
        const v = await fn();
        if (v) return v;
      } catch {}
      if (Date.now() > end) return null;
      await sleep(every);
    }
  }

  function jsonLd() {
    const out = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent.trim());
        const stack = Array.isArray(data) ? [...data] : [data];
        while (stack.length) {
          const o = stack.shift();
          if (!o || typeof o !== "object") continue;
          out.push(o);
          if (Array.isArray(o["@graph"])) stack.push(...o["@graph"]);
        }
      } catch {}
    }
    return out;
  }

  function nextData() {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  }

  /** Depth-first walk collecting objects that match pred (cycle-safe, bounded). */
  function findAll(root, pred, limit = 200) {
    const out = [];
    const seen = new Set();
    const stack = [root];
    let steps = 0;
    while (stack.length && out.length < limit && steps++ < 200000) {
      const o = stack.pop();
      if (!o || typeof o !== "object" || seen.has(o)) continue;
      seen.add(o);
      if (!Array.isArray(o) && pred(o)) out.push(o);
      const vals = Array.isArray(o) ? o : Object.values(o);
      for (let i = vals.length - 1; i >= 0; i--) if (vals[i] && typeof vals[i] === "object") stack.push(vals[i]);
    }
    return out;
  }

  const isType = (o, t) => [].concat(o?.["@type"] ?? []).some((x) => String(x).toLowerCase() === t.toLowerCase());

  /** The Product in JSON-LD, as a candidate. */
  function productFromJsonLd() {
    const p = jsonLd().find((o) => isType(o, "Product"));
    if (!p) return null;
    const offers = [].concat(p.offers ?? []);
    const agg = offers.find((o) => isType(o, "AggregateOffer")) || null;
    const priced = offers.map((o) => ({ o, v: parseNumber(o.lowPrice ?? o.price) })).filter((x) => x.v);
    const best = agg && parseNumber(agg.lowPrice ?? agg.price) ? { o: agg, v: parseNumber(agg.lowPrice ?? agg.price) } : priced.sort((a, b) => a.v - b.v)[0];
    const avail = String(best?.o?.availability ?? offers[0]?.availability ?? "");
    return {
      title: String(p.name ?? "").trim(),
      price: best?.v ?? null,
      currency: String(best?.o?.priceCurrency ?? "").toUpperCase() || null,
      url: abs(p.url || p.offers?.url || location.href),
      in_stock: avail ? /InStock|LimitedAvailability|OnlineOnly|PreOrder/i.test(avail) : best?.v ? true : null,
      seller_count: parseNumber(agg?.offerCount) ?? (offers.length > 1 ? offers.length : null),
      seller: offers.length === 1 ? offers[0]?.seller?.name ?? null : null,
    };
  }

  const abs = (u) => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return null;
    }
  };

  /** Prices shown on the page ("۱۲٬۵۰۰٬۰۰۰ تومان"), to tell Rial from Toman. */
  function visiblePrices() {
    const text = document.body?.innerText ?? "";
    const re = /([\d۰-۹٠-٩][\d۰-۹٠-٩٬,،.٫]{2,})\s*(تومان|ریال)/g;
    const out = [];
    let m;
    while ((m = re.exec(text)) && out.length < 300) {
      const v = parseNumber(m[1]);
      if (v) out.push({ value: v, unit: m[2] === "ریال" ? "IRR" : "IRT" });
    }
    return out;
  }

  /**
   * Decide the currency of a structured price by comparing with what the page
   * shows. Falls back to the hint (priceCurrency / the site's convention).
   */
  function reconcile(value, hint) {
    if (!value) return hint || "IRT";
    const shown = visiblePrices();
    for (const s of shown) {
      if (s.value === value) return s.unit;
      if (s.unit === "IRT" && s.value * 10 === value) return "IRR";
      if (s.unit === "IRR" && s.value === value * 10) return "IRT";
    }
    const h = String(hint || "").toUpperCase();
    if (h === "IRR" || h === "RIAL") return "IRR";
    return "IRT";
  }

  /** CAPTCHA / bot-check / blocked pages. */
  function blockedReason() {
    const t = (document.title + " " + (document.body?.innerText ?? "").slice(0, 3000)).toLowerCase();
    if (/captcha|کپچا|من ربات نیستم|i'?m not a robot|verify you are human|arvancloud|challenge/.test(t)) {
      return "سایت درخواست تأیید «ربات نیستم» دارد. یک بار سایت را در یک تب عادی باز کنید و دوباره امتحان کنید.";
    }
    if (/403 forbidden|access denied|دسترسی.*(غیرمجاز|محدود)/.test(t)) return "سایت دسترسی را محدود کرده است.";
    return null;
  }

  async function fetchJson(url, init) {
    const r = await fetch(url, { credentials: "include", ...init });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  /** A short description of the page (shown in the popup's test result). */
  function pageSnapshot() {
    const links = [...document.querySelectorAll("a[href]")]
      .map((a) => ({ text: (a.innerText || a.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60), href: a.getAttribute("href") }))
      .filter((l) => l.text && l.href && !l.href.startsWith("#") && !l.href.startsWith("javascript"));
    const classes = {};
    for (const el of document.querySelectorAll("[class]")) for (const c of el.classList) if (/prod|item|card|price|result|search/i.test(c)) classes[c] = (classes[c] || 0) + 1;
    return {
      url: location.href,
      title: document.title,
      text: (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 500),
      links: links.length,
      sampleLinks: links.slice(20, 35),
      classes: Object.entries(classes).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([c, n]) => `${c}:${n}`).join(" "),
      generator: document.querySelector('meta[name="generator"]')?.getAttribute("content") ?? null,
      prices: visiblePrices().slice(0, 5),
      steps: globalThis.__pkSteps ?? [],
      // requests the page made in the background (e.g. a search-as-you-type API)
      requests: performance.getEntriesByType("resource").filter((e) => ["fetch", "xmlhttprequest"].includes(e.initiatorType)).slice(-8).map((e) => e.name.slice(0, 200)),
    };
  }

  globalThis.__pkParsers = globalThis.__pkParsers || {};
  globalThis.__pk = { toLatin, parseNumber, sleep, waitFor, jsonLd, nextData, findAll, isType, productFromJsonLd, abs, visiblePrices, reconcile, blockedReason, fetchJson };

  /** Called by the background worker: run the site's parser, never throw. */
  globalThis.__pkRun = async (site, ctx) => {
    const parser = globalThis.__pkParsers[site];
    if (!parser) return { error: "parser missing" };
    try {
      const res = await parser(ctx, globalThis.__pk);
      if ((!res || !res.candidates?.length) && blockedReason()) return { blocked: blockedReason(), kind: res?.kind ?? "unknown", candidates: [] };
      // nothing found: report what the page looked like, for fixing the parser remotely
      if (res && res.kind !== "navigating" && !res.candidates?.length) res.debug = pageSnapshot();
      else if (res && res.kind === "links") res.debug = { steps: globalThis.__pkSteps ?? [] };
      return res;
    } catch (e) {
      return { error: String(e?.message || e), candidates: [] };
    }
  };
})();
