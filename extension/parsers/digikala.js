// digikala.com. Digikala's own JSON API gives prices in RIAL; the page shows Toman.
// Product page /product/dkp-<id>/: JSON-LD Product → the product JSON the page itself loads
// (api.digikala.com/v2/product/<id>/) → page text.
// Search page /search/?q=…: the search JSON the page itself loads (api.digikala.com/v1/search/)
// → product cards on the page.
(() => {
  function fromApiProduct(p, pk) {
    const v = p.default_variant && !Array.isArray(p.default_variant) ? p.default_variant : null;
    const rial = pk.parseNumber(v?.price?.selling_price);
    const uri = p.url?.uri || (p.id ? `/product/dkp-${p.id}/` : null);
    return {
      title: String(p.title_fa || p.title_en || "").trim(),
      price: rial || null,
      currency: "IRR",
      url: uri ? new URL(uri, "https://www.digikala.com").href : null,
      in_stock: p.status ? p.status === "marketable" && !!rial : !!rial,
      seller: v?.seller?.title ?? null,
      seller_count: Array.isArray(p.variants) ? new Set(p.variants.map((x) => x?.seller?.id).filter(Boolean)).size || null : null,
    };
  }

  function domCandidates(pk) {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/product/dkp-"]')) {
      const href = a.getAttribute("href").split("?")[0];
      if (seen.has(href)) continue;
      const text = a.innerText || "";
      const m = /([\d۰-۹٬,]{4,})\s*(تومان)?\s*$/m.exec(text) || /([\d۰-۹٬,]{4,})/.exec(text);
      const title = (a.querySelector("h3,h2")?.innerText || text.split("\n")[0] || "").trim();
      if (!title) continue;
      seen.add(href);
      const price = m ? pk.parseNumber(m[1]) : null;
      out.push({ title, price, currency: "IRT", url: pk.abs(href), in_stock: !!price && !/ناموجود/.test(text), seller: null, seller_count: null });
      if (out.length >= 30) break;
    }
    return out;
  }

  async function productPage(ctx, pk) {
    const id = /dkp-(\d+)/.exec(location.pathname)?.[1];
    const ld = await pk.waitFor(() => pk.productFromJsonLd(), 5000);
    if (ld?.title && ld.price) {
      const currency = pk.reconcile(ld.price, ld.currency || "IRR");
      return { kind: "product", candidates: [{ ...ld, currency, url: location.href.split("?")[0] }] };
    }
    if (id) {
      try {
        const api = await pk.fetchJson(`https://api.digikala.com/v2/product/${id}/`);
        const p = api?.data?.product;
        if (p) return { kind: "product", candidates: [{ ...fromApiProduct(p, pk), url: location.href.split("?")[0] }] };
      } catch {}
    }
    const h1 = document.querySelector("h1")?.innerText?.trim();
    const shown = pk.visiblePrices().filter((p) => p.unit === "IRT").map((p) => p.value);
    if (h1 && shown.length) return { kind: "product", candidates: [{ title: h1, price: Math.min(...shown), currency: "IRT", url: location.href.split("?")[0], in_stock: true, seller: null, seller_count: null }] };
    return { kind: "product", candidates: [], outOfStock: /ناموجود/.test(document.body?.innerText ?? "") };
  }

  async function searchPage(ctx, pk) {
    try {
      const q = encodeURIComponent(ctx.term);
      const api = await pk.fetchJson(`https://api.digikala.com/v1/search/?q=${q}&page=1`);
      const products = api?.data?.products;
      if (Array.isArray(products) && products.length) return { kind: "search", candidates: products.slice(0, 30).map((p) => fromApiProduct(p, pk)) };
      if (Array.isArray(products)) return { kind: "search", candidates: [] };
    } catch {}
    const dom = await pk.waitFor(() => { const c = domCandidates(pk); return c.length ? c : null; }, 12000);
    return { kind: "search", candidates: dom ?? [] };
  }

  globalThis.__pkParsers.digikala = (ctx, pk) => (/\/product\/dkp-\d+/.test(location.pathname) ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
