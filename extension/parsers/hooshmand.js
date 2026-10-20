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
    // the buy box: walk up from the «افزودن به سبد» button until a price shows up
    // (on hooshmandco.com the price sits there, apart from the <h1>; related products further down)
    let scope = h1;
    const buy = [...document.querySelectorAll("button, a, [role=button]")].find(
      (b) => /افزودن به سبد|خرید/.test(b.innerText || "") && !b.closest("a[href] a, .product-thumb, .card-section-scroll-area") && visible(b),
    );
    for (let el = buy?.parentElement, d = 0; !price && el && el !== document.body && d < 5; el = el.parentElement, d++) {
      price = priceIn(el.innerText || "", pk);
      if (price) scope = el;
    }
    // else the price closest to the <h1>
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

  const visible = (el) => !!el && (el.offsetParent !== null || el.getClientRects().length > 0);
  const steps = (globalThis.__pkSteps = []);
  const step = (t) => steps.push(t);
  const SEARCH_INPUT = 'input[type="search"], input[name="search"], input[name="q"], input[name="s"], input[placeholder*="جستجو"], input[placeholder*="جست"], input[type="text"]';
  const findInput = () => [...document.querySelectorAll(SEARCH_INPUT)].find(visible) ?? null;

  /** Type like a person: click the box (it may open a search overlay), then insert the text. */
  async function typeLikeAPerson(term, pk) {
    let input = findInput();
    if (!input) return null;
    input.scrollIntoView({ block: "center" });
    input.focus();
    input.click();
    await pk.sleep(400);
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active !== input && visible(active)) input = active;
    else {
      const again = findInput();
      if (again && again !== input) input = again;
    }
    input.focus();
    input.select?.();
    let how = "execCommand";
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, term);
    } catch {}
    if (!ok || input.value !== term) {
      how = "setter";
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, term);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: term }));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: term.slice(-1), bubbles: true }));
    step(`input placeholder="${input.placeholder}" typed via ${how}, value="${input.value}"`);
    return input;
  }

  /**
   * hooshmandco.com searches while you type: matching products appear in a list
   * under the search box (title + «مشاهده محصول»). The list items may be plain
   * links or elements that only react to a click, and the same products may also
   * be on the page already, so new elements are recognised by identity, not by address.
   * Returns { kind: "links", candidates: [{ title, url | index }] } — background.js
   * picks the best one and opens it (by address, or by clicking item `index`).
   */
  async function dropdownSearch(ctx, pk) {
    const before = new WeakSet(document.querySelectorAll("*"));
    const input = await typeLikeAPerson(ctx.term, pk);
    if (!input) {
      step("no search box found");
      return null;
    }
    const q = squash(pk.toLatin(ctx.term));
    const isNew = (el) => !before.has(el) && visible(el);
    const lines = (el) => (el.innerText || "").split("\n").map((t) => t.trim()).filter(Boolean);
    const found = await pk.waitFor(() => {
      const fresh = [...document.querySelectorAll("body *")].filter(isNew);
      if (!fresh.length) return null;
      // the "search for «…»" entry
      const searchEl = fresh.find((el) => /^جستجو/.test((el.innerText || "").trim()) && squash(pk.toLatin(el.innerText)).includes(q.slice(0, 10)) && lines(el).length <= 2);
      // product entries: an element holding «مشاهده محصول» plus a title, or a new product link
      const items = [];
      const add = (el) => {
        if (!el || items.some((x) => x === el || x.contains(el) || el.contains(x))) return;
        if (searchEl && (el === searchEl || el.contains(searchEl) || searchEl.contains(el))) return;
        items.push(el);
      };
      for (const leaf of fresh.filter((el) => /^مشاهده/.test((el.innerText || "").trim()) && lines(el).length === 1)) {
        let el = leaf;
        for (let d = 0; el && d < 5 && lines(el).filter((l) => !/^مشاهده/.test(l)).length === 0; d++) el = el.parentElement;
        add(el?.closest("a[href]") ?? el);
      }
      if (!items.length) {
        for (const a of fresh.filter((el) => el.tagName === "A" && el.getAttribute("href") && !/^(#|javascript)/.test(el.getAttribute("href")))) {
          if (lines(a).length && !/^جستجو/.test(lines(a)[0])) add(a);
        }
      }
      return items.length || searchEl ? { items, searchEl, fresh: fresh.length } : null;
    }, 9000, 250);
    if (!found) {
      step("no list appeared under the search box within 9 s");
      return { kind: "links", candidates: [] };
    }
    step(`list: ${found.items.length} products, search entry: ${found.searchEl ? "yes" : "no"}, new elements: ${found.fresh}`);
    if (!found.items.length && found.searchEl) {
      const a = found.searchEl.closest("a[href]");
      if (a) location.assign(a.href);
      else found.searchEl.click();
      return { kind: "navigating" };
    }
    globalThis.__pkItems = found.items;
    const candidates = found.items.map((el, index) => {
      const a = el.closest("a[href]") ?? el.querySelector("a[href]");
      const title = lines(el).filter((l) => !/^مشاهده/.test(l))[0] ?? "";
      const p = priceIn(el.innerText || "", pk);
      return { title, price: p?.value ?? null, currency: p?.unit ?? "IRT", url: a ? a.href.split("#")[0] : null, index, in_stock: null, seller: SELLER, seller_count: null };
    }).filter((c) => c.title);
    step(`titles: ${candidates.map((c) => c.title).slice(0, 5).join(" | ")}`);
    return { kind: "links", candidates };
  }

  /** Called by background.js: click list item i (when it has no address). */
  globalThis.__pkClickItem = (i) => {
    const el = globalThis.__pkItems?.[i];
    if (!el) return false;
    const target = el.closest("a, button, [role=option], li") ?? el;
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    target.click();
    return true;
  };

  async function searchPage(ctx, pk) {
    if (isNotFound()) return { kind: "navigating", home: true }; // e.g. an old learned address
    if (!onResultsPage(ctx)) {
      const r = await dropdownSearch(ctx, pk);
      if (r?.kind === "links" && r.candidates.length) return r;
      if (r?.kind === "navigate") {
        location.assign(r.url);
        return { kind: "navigating" };
      }
      if (r) return { kind: "search", candidates: [] }; // typed, nothing matched (debug added by common.js)
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
