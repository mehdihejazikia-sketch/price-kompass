// emalls.ir. Prices are shown in Toman.
// Product page …~id~<n>: JSON-LD Product with AggregateOffer (lowPrice, offerCount) → page text.
// Search: we open the home page and use eMalls' own search box (its address format is not
// documented); the results address is then remembered by background.js for next time.
// Results: item links on the page → the list the page loads from /_Search.ashx.
(() => {
  function domCandidates(pk) {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="~id~"], a[href*="~Id~"]')) {
      const href = a.getAttribute("href");
      if (seen.has(href)) continue;
      // the card around the link holds title + price
      const card = a.closest("li, article, .item, .product, div") || a;
      const text = card.innerText || "";
      const m = /([\d۰-۹٬,]{4,})\s*تومان/.exec(text);
      const title = (a.getAttribute("title") || a.innerText || "").trim().split("\n")[0];
      if (!title || title.length < 3) continue;
      seen.add(href);
      const shops = /(\d+)\s*فروشگاه/.exec(pk.toLatin(text));
      out.push({ title, price: m ? pk.parseNumber(m[1]) : null, currency: "IRT", url: pk.abs(href), in_stock: !!m && !/ناموجود/.test(text), seller_count: shops ? Number(shops[1]) : null, seller: null });
      if (out.length >= 30) break;
    }
    return out.filter((c) => c.price || out.length < 5);
  }

  /** Field names of the ashx response vary; read them generically. */
  function fromAshxItem(it, pk) {
    const vals = Object.entries(it);
    const str = (re) => vals.find(([k, v]) => re.test(k) && typeof v === "string" && v.trim())?.[1];
    const title = str(/title|name|onvan/i) || vals.filter(([, v]) => typeof v === "string" && /[؀-ۿ]/.test(v)).map(([, v]) => v).sort((a, b) => b.length - a.length)[0];
    const price = pk.parseNumber(str(/price/i) ?? it.price);
    const link = vals.find(([, v]) => typeof v === "string" && /~id~/i.test(v))?.[1] || (it.id ? `/~id~${it.id}` : null);
    const shops = pk.parseNumber(str(/shop|count/i) ?? it.shopcount);
    return { title: String(title ?? "").trim(), price: price || null, currency: "IRT", url: link ? pk.abs(link) : null, in_stock: !!price, seller_count: shops || null, seller: null };
  }

  async function productPage(ctx, pk) {
    const ld = await pk.waitFor(() => pk.productFromJsonLd(), 8000);
    if (ld?.title) return { kind: "product", candidates: [{ ...ld, currency: pk.reconcile(ld.price, ld.currency || "IRT"), url: location.href.split("?")[0] }] };
    const h1 = document.querySelector("h1")?.innerText?.trim();
    const shown = pk.visiblePrices().filter((p) => p.unit === "IRT").map((p) => p.value);
    if (h1) return { kind: "product", candidates: [{ title: h1, price: shown.length ? Math.min(...shown) : null, currency: "IRT", url: location.href.split("?")[0], in_stock: shown.length > 0, seller: null, seller_count: null }] };
    return { kind: "product", candidates: [] };
  }

  const squash = (v) => String(v ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const isNotFound = () => /خطای\s*(۴۰۴|404)|صفحه مورد نظر پیدا نشد/.test(document.body?.innerText ?? "");
  function onResultsPage(ctx) {
    let url = location.href;
    try {
      url = decodeURIComponent(url);
    } catch {}
    return squash(url).includes(squash(ctx.term).slice(0, 14));
  }

  /** Use eMalls' own search box, like a person: type the term and press Enter. */
  function typeIntoSearchBox(term) {
    const input = [...document.querySelectorAll('input[type="search"], input[name*="search" i], input[id*="search" i], input[placeholder*="جستجو"], input[name="q"], input[type="text"]')]
      .find((el) => el.offsetParent !== null || el.getClientRects().length);
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, term);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    }
    const form = input.closest("form");
    if (form) setTimeout(() => (form.requestSubmit ? form.requestSubmit() : form.submit()), 300);
    return true;
  }

  async function searchPage(ctx, pk) {
    if (!onResultsPage(ctx)) {
      // home page (or a learned address that no longer works): search with the search box
      if (!isNotFound() && (await pk.waitFor(() => typeIntoSearchBox(ctx.term), 6000))) return { kind: "navigating" };
      return { kind: "navigating", home: true };
    }
    const dom = await pk.waitFor(() => { const c = domCandidates(pk); return c.length ? c : null; }, 9000);
    if (dom) return { kind: "search", candidates: dom, searchUrl: location.href };
    try {
      const body = new URLSearchParams({ entekhab: "listitemv2", currenturl: location.href, findstr: ctx.term, pagenum: "1", sort: "", exist: "", shop: "0", minprice: "0", maxprice: "0" });
      const data = await pk.fetchJson("/_Search.ashx", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const items = data?.lstsearchresualt || data?.lstsearchresult || [];
      if (Array.isArray(items) && items.length) return { kind: "search", candidates: items.slice(0, 30).map((it) => fromAshxItem(it, pk)).filter((c) => c.title), searchUrl: location.href };
    } catch {}
    if (isNotFound()) return { kind: "navigating", home: true };
    return { kind: "search", candidates: [], searchUrl: location.href };
  }

  globalThis.__pkParsers.emalls = (ctx, pk) => (/~id~/i.test(decodeURIComponent(location.pathname)) ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
