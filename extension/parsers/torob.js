// torob.com. Prices on Torob are in Toman.
// Product page /p/<id>/…: __NEXT_DATA__ baseProduct (name1, min_price, products_info) → JSON-LD → page text.
// Search page /search/?query=…: __NEXT_DATA__ results (name1, price, shop_text, web_client_absolute_url)
// → Torob's own search API (the same JSON the page uses) → product links on the page.
(() => {
  const SITE = "https://torob.com";

  function fromRow(r, pk) {
    const price = pk.parseNumber(r.price) || pk.parseNumber(r.price_text);
    const shop = String(r.shop_text ?? "");
    const count = /(\d+)\s*فروشگاه/.exec(pk.toLatin(shop));
    const path = r.web_client_absolute_url || r.product_page_url || (r.random_key ? `/p/${r.random_key}/` : "");
    return {
      title: [r.name1, r.name2].filter(Boolean).join(" ").trim() || String(r.name ?? ""),
      price: price || null,
      currency: "IRT",
      url: path ? pk.abs(new URL(path, SITE).href) : null,
      in_stock: typeof r.availability === "boolean" ? r.availability : !!price && !/ناموجود|out_of_stock/i.test(String(r.stock_status ?? "")),
      seller_count: count ? Number(count[1]) : null,
      seller: count ? null : shop.replace(/^در\s+/, "").trim() || null,
    };
  }

  async function productPage(ctx, pk) {
    const data = await pk.waitFor(() => {
      const nd = pk.nextData();
      const bp = nd && (pk.findAll(nd, (o) => o.name1 && ("products_info" in o || "min_price" in o), 1)[0]);
      return bp || pk.productFromJsonLd();
    }, 12000);
    if (data && data.name1) {
      const offers = Array.isArray(data.products_info?.result) ? data.products_info.result : [];
      const available = offers.filter((o) => o.availability !== false && pk.parseNumber(o.price));
      const cheapest = available.sort((a, b) => pk.parseNumber(a.price) - pk.parseNumber(b.price))[0];
      const price = pk.parseNumber(data.min_price) || (cheapest && pk.parseNumber(cheapest.price)) || pk.parseNumber(data.price);
      return {
        kind: "product",
        candidates: [{
          title: [data.name1, data.name2].filter(Boolean).join(" ").trim(),
          price: price || null,
          currency: "IRT",
          url: location.href.split("?")[0],
          in_stock: price ? available.length > 0 || offers.length === 0 : false,
          seller_count: available.length || null,
          seller: cheapest?.shop_name ?? null,
        }],
      };
    }
    if (data && data.title !== undefined) {
      return { kind: "product", candidates: [{ ...data, currency: pk.reconcile(data.price, "IRT"), url: location.href.split("?")[0] }] };
    }
    return { kind: "product", candidates: domCandidates(pk).slice(0, 1) };
  }

  function domCandidates(pk) {
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/p/"]')) {
      const text = a.innerText || "";
      const m = /([\d۰-۹٬,]{4,})\s*تومان/.exec(text);
      if (!m) continue;
      const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
      const count = /(\d+)\s*فروشگاه/.exec(pk.toLatin(text));
      out.push({ title: lines[0], price: pk.parseNumber(m[1]), currency: "IRT", url: pk.abs(a.getAttribute("href")), in_stock: true, seller_count: count ? Number(count[1]) : null, seller: null });
      if (out.length >= 30) break;
    }
    return out;
  }

  async function searchPage(ctx, pk) {
    const fromNext = () => {
      const nd = pk.nextData();
      if (!nd) return null;
      const rows = pk.findAll(nd, (o) => typeof o.name1 === "string" && ("price" in o || "price_text" in o), 60);
      return rows.length ? rows : null;
    };
    let rows = await pk.waitFor(fromNext, 4000);
    if (!rows) {
      try {
        const q = encodeURIComponent(ctx.term);
        const api = await pk.fetchJson(`https://api.torob.com/v4/base-product/search/?q=${q}&page=0&sort=popularity&size=24&source=next_desktop`);
        rows = Array.isArray(api.results) ? api.results : null;
      } catch {}
    }
    if (rows) return { kind: "search", candidates: rows.map((r) => fromRow(r, pk)).filter((c) => c.title) };
    const dom = await pk.waitFor(() => { const c = domCandidates(pk); return c.length ? c : null; }, 8000);
    return { kind: "search", candidates: dom ?? [] };
  }

  globalThis.__pkParsers.torob = (ctx, pk) => (/^\/p\//.test(location.pathname) ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
