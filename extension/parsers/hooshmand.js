// hooshmandco.com. Product pages look like /rapoo-nk8800-keyboard. The real site
// searches while you type (a list of products under the search box, no results
// page; /index.php?route=… is its "پیدا نشد! آدرس مورد نظر شما معتبر نیست" page).
// Flow: type into the search box → read the product list → background.js opens
// the best-matching product page → price next to the <h1>. Fallbacks below
// cover shops with a results page:
// - search: the shop's search address (OpenCart index.php?route=product/search,
//   a search <form>, WordPress ?s=), else a list of usual addresses, one per
//   attempt; the working address is remembered by background.js
// - results: JSON-LD → product cards (OpenCart .product-thumb, WooCommerce) →
//   any product link with a price next to it
// - product page (pinned link or a single hit): JSON-LD → price meta tags →
//   the price next to the product's <h1>
(() => {
  const SELLER = "هوشمند";
  const squash = (v) => String(v ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const bodyText = () => document.body?.innerText ?? "";
  const isNotFound = () =>
    /(^|\s)(404|۴۰۴)(\s|$)|صفحه (مورد نظر )?(یافت|پیدا) نشد|آدرس مورد نظر (شما )?معتبر نیست|^\s*پیدا نشد!|page not found/i.test((document.title || "") + " " + bodyText().slice(0, 2000));
  const isOpenCart = () =>
    !!document.querySelector('a[href*="route="], link[href*="catalog/view"], script[src*="catalog/view"], img[src*="image/cache"], #search input[name="search"], input[name="search"]');
  const isWordPress = () => !!document.querySelector('link[href*="wp-content"], script[src*="wp-content"], meta[name="generator"][content*="WordPress" i]');
  const OUT_OF_STOCK = /ناموجود|موجود نیست|تمام شد|اتمام موجودی|عدم موجودی|out of stock/i;

  function onResultsPage(ctx) {
    let url = location.href;
    try {
      url = decodeURIComponent(url.replace(/\+/g, " "));
    } catch {}
    return squash(url).includes(squash(ctx.term).slice(0, 14));
  }

  /** Lowest "… تومان" / "… ریال" in a text. */
  function priceIn(text, pk) {
    const re = /([\d۰-۹٠-٩][\d۰-۹٠-٩٬,،.]{2,})\s*(تومان|ریال|﷼)/g;
    let best = null;
    let m;
    while ((m = re.exec(text))) {
      const v = pk.parseNumber(m[1]);
      if (!v || v < 1000) continue;
      const unit = m[2] === "تومان" ? "IRT" : "IRR";
      const toman = unit === "IRR" ? v / 10 : v;
      if (!best || toman < best.toman) best = { value: v, unit, toman };
    }
    return best;
  }

  /** Price box: the sale price (.price-new / <ins>) when there is one. */
  function priceOfBox(box, pk) {
    if (!box) return null;
    const sale = box.querySelector(".price-new, ins, .special-price, .new-price, .sale-price");
    return priceIn((sale ?? box).innerText || "", pk) ?? priceIn(box.innerText || "", pk);
  }

  function cards(pk) {
    const els = document.querySelectorAll(".product-thumb, .product-layout, ul.products li.product, .products .product, .product-item, .product-box, .product-card");
    const out = [];
    for (const card of els) {
      const link = card.querySelector(".caption a[href], h4 a[href], h3 a[href], h2 a[href], .name a[href], a.woocommerce-LoopProduct-link, a[href]");
      if (!link) continue;
      const title = (card.querySelector(".caption h4, .caption .name, .name, h4, h3, h2, .woocommerce-loop-product__title")?.innerText || link.getAttribute("title") || link.innerText || "").trim();
      if (title.length < 3) continue;
      const p = priceOfBox(card.querySelector(".price, .product-price") ?? card, pk);
      const text = card.innerText || "";
      out.push({ title, price: p?.value ?? null, currency: p?.unit ?? "IRT", url: pk.abs(link.getAttribute("href")), in_stock: !!p && !OUT_OF_STOCK.test(text), seller: SELLER, seller_count: null });
      if (out.length >= 30) break;
    }
    return out;
  }

  /** Any page: group links by address and read the price from the box around each one. */
  function linkCards(pk) {
    const here = location.pathname;
    const keyOf = (href) => {
      try {
        const u = new URL(href, location.href);
        return u.origin === location.origin ? u.origin + u.pathname + (u.searchParams.get("product_id") ? `?product_id=${u.searchParams.get("product_id")}` : "") : "";
      } catch {
        return "";
      }
    };
    const byKey = new Map();
    for (const a of document.querySelectorAll("a[href]")) {
      const key = keyOf(a.getAttribute("href"));
      if (!key) continue;
      const path = new URL(key).pathname;
      if (path === "/" || path === here || /\/(cart|checkout|account|login|register|wishlist|compare|tag|category|blog|page)\b/i.test(path)) continue;
      const item = byKey.get(key) ?? { key, title: "", links: [] };
      const t = (a.getAttribute("title") || a.innerText || a.querySelector("img")?.getAttribute("alt") || "").trim().split("\n")[0];
      if (t.length > item.title.length) item.title = t;
      item.links.push(a);
      byKey.set(key, item);
    }
    const out = [];
    for (const item of byKey.values()) {
      if (item.title.length < 4) continue;
      let box = item.links[0];
      for (let el = box.parentElement, d = 0; el && el !== document.body && d < 8; el = el.parentElement, d++) {
        const keys = new Set([...el.querySelectorAll("a[href]")].map((x) => keyOf(x.getAttribute("href"))).filter((k) => byKey.has(k)));
        if (keys.size > 1) break;
        box = el;
      }
      const p = priceOfBox(box, pk);
      if (!p) continue;
      out.push({ title: item.title, price: p.value, currency: p.unit, url: item.key, in_stock: !OUT_OF_STOCK.test(box.innerText || ""), seller: SELLER, seller_count: null });
      if (out.length >= 30) break;
    }
    return out;
  }

  async function productPage(ctx, pk) {
    await pk.waitFor(() => document.querySelector("h1") || pk.productFromJsonLd(), 6000);
    const url = location.href.split("#")[0];
    const ld = pk.productFromJsonLd();
    if (ld?.title && ld.price) return { kind: "product", candidates: [{ ...ld, currency: pk.reconcile(ld.price, ld.currency || "IRT"), url, seller: SELLER }] };
    const h1 = document.querySelector("h1");
    const title = (h1?.innerText || ld?.title || document.title || "").trim();
    // price meta tags (og / schema.org microdata)
    const meta = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"]');
    const metaVal = pk.parseNumber(meta?.getAttribute("content") ?? meta?.textContent);
    let price = null;
    if (metaVal) {
      const cur = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"], [itemprop="priceCurrency"]');
      price = { value: metaVal, unit: pk.reconcile(metaVal, cur?.getAttribute("content") || "IRT") };
    }
    // the price box closest to the <h1>: walk up from the title until a price shows up
    let scope = h1;
    for (let el = h1?.parentElement, d = 0; !price && el && el !== document.body && d < 6; el = el.parentElement, d++) {
      const box = el.querySelector(".price-new, .price, .product-price, #product .list-unstyled h2") ?? null;
      price = box ? priceOfBox(box, pk) : priceIn(el.innerText || "", pk);
      scope = el;
    }
    const stockText = (scope?.innerText ?? bodyText()).slice(0, 5000);
    return {
      kind: "product",
      candidates: title ? [{ title, price: price?.value ?? null, currency: price?.unit ?? "IRT", url, in_stock: !!price && !OUT_OF_STOCK.test(stockText), seller: SELLER, seller_count: null }] : [],
    };
  }

  /** Where to search from this page; null = no idea. Tries a different usual address per attempt. */
  function searchAddress(ctx) {
    const q = encodeURIComponent(ctx.term);
    const input = document.querySelector('input[name="search"], input[name="s"], input[name="q"], input[type="search"], input[name*="search" i]');
    const form = input?.closest("form");
    if (form && form.getAttribute("action") !== null && input.name) {
      const u = new URL(form.getAttribute("action") || location.pathname, location.href);
      for (const [k, v] of new FormData(form)) if (typeof v === "string" && k !== input.name) u.searchParams.set(k, v);
      u.searchParams.set(input.name, ctx.term);
      return u.href;
    }
    if (isOpenCart()) return `/index.php?route=product/search&search=${q}`;
    if (isWordPress()) return `/?s=${q}&post_type=product`;
    const guesses = [`/index.php?route=product/search&search=${q}`, `/search?q=${q}`, `/search?query=${q}`, `/?s=${q}`, `/search/${q}`];
    return guesses[(ctx.attempt ?? 0) % guesses.length];
  }

  /**
   * hooshmandco.com searches while you type: matching products appear in a list
   * under the search box (title + «مشاهده محصول»), there is no results page.
   * Type the term like a person and read that list: product titles + addresses.
   * background.js then opens the best-matching product page and reads its price.
   */
  async function dropdownSearch(ctx, pk) {
    const input = [...document.querySelectorAll('input[type="search"], input[name="search"], input[name="q"], input[name="s"], input[placeholder*="جستجو"], input[type="text"]')]
      .find((el) => el.offsetParent !== null || el.getClientRects().length);
    if (!input) return null;
    const before = new Set([...document.querySelectorAll("a[href]")].map((a) => a.href));
    input.focus();
    input.click();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ctx.term);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
    const isSearchLink = (a) => /جستجو/.test(a.innerText || "") || /[?&](q|s|search|query|keyword)=/i.test(a.href);
    const found = await pk.waitFor(() => {
      const fresh = [...document.querySelectorAll("a[href]")].filter((a) => !before.has(a.href) && a.href.startsWith(location.origin));
      const products = fresh.filter((a) => !isSearchLink(a));
      return products.length ? { products, search: fresh.find(isSearchLink) ?? null } : null;
    }, 8000, 250);
    if (!found) {
      // no list: maybe the list has a "search for …" link only, or nothing at all
      const searchLink = [...document.querySelectorAll("a[href]")].find((a) => !before.has(a.href) && isSearchLink(a));
      return searchLink ? { kind: "navigate", url: searchLink.href } : { kind: "links", candidates: [] };
    }
    const seen = new Set();
    const candidates = [];
    for (const a of found.products) {
      const url = a.href.split("#")[0];
      if (seen.has(url)) continue;
      seen.add(url);
      const lines = (a.innerText || a.getAttribute("title") || a.querySelector("img")?.getAttribute("alt") || "")
        .split("\n").map((t) => t.trim()).filter((t) => t && !/^مشاهده/.test(t));
      if (!lines.length) continue;
      const p = priceIn(a.innerText || "", pk);
      candidates.push({ title: lines[0], price: p?.value ?? null, currency: p?.unit ?? "IRT", url, in_stock: null, seller: SELLER, seller_count: null });
    }
    return { kind: "links", candidates };
  }

  async function searchPage(ctx, pk) {
    if (isNotFound()) return { kind: "navigating", home: true }; // e.g. an old learned address
    if (!onResultsPage(ctx)) {
      const r = await dropdownSearch(ctx, pk);
      if (r?.kind === "links" && r.candidates.length) return r;
      if (r?.kind === "navigate") {
        location.assign(r.url);
        return { kind: "navigating" };
      }
      if (r) return { kind: "search", candidates: [] }; // typed, nothing matched
      // no search box on this page: a usual search address
      location.assign(searchAddress(ctx));
      return { kind: "navigating" };
    }
    // a results page (a learned search address)
    const found = await pk.waitFor(() => {
      const c = cards(pk);
      if (c.some((x) => x.price)) return c;
      const l = linkCards(pk);
      return l.length ? l : null;
    }, 9000);
    if (found) return { kind: "search", candidates: found, searchUrl: location.href };
    return { kind: "search", candidates: [], searchUrl: location.href };
  }

  globalThis.__pkParsers.hooshmand = (ctx, pk) => (ctx.pinned ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
