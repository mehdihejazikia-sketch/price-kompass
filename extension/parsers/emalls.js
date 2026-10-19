// emalls.ir. Prices are shown in Toman.
// Product page …~id~<n>: JSON-LD Product with AggregateOffer (lowPrice, offerCount) → page text.
// Search page (لیست-قیمت~Search~…): the result list the page loads from /_Search.ashx → item links on the page.
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

  async function searchPage(ctx, pk) {
    const dom = await pk.waitFor(() => { const c = domCandidates(pk); return c.length ? c : null; }, 9000);
    if (dom) return { kind: "search", candidates: dom };
    try {
      const body = new URLSearchParams({ entekhab: "listitemv2", currenturl: location.href, findstr: ctx.term, pagenum: "1", sort: "", exist: "", shop: "0", minprice: "0", maxprice: "0" });
      const data = await pk.fetchJson("/_Search.ashx", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const items = data?.lstsearchresualt || data?.lstsearchresult || [];
      if (Array.isArray(items)) return { kind: "search", candidates: items.slice(0, 30).map((it) => fromAshxItem(it, pk)).filter((c) => c.title) };
    } catch {}
    return { kind: "search", candidates: [] };
  }

  globalThis.__pkParsers.emalls = (ctx, pk) => (/~id~/i.test(decodeURIComponent(location.pathname)) ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
