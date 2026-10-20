// hooshmandco.com (shop, prices on the site's own pages).
// The site's layout is not known in advance, so this parser is general:
// - search: the site's own search box (like a person); on WordPress shops the
//   standard address /?s=…&post_type=product; the results address is then
//   remembered by background.js for the next checks
// - results: JSON-LD → WooCommerce product cards → any product link with a price next to it
// - product page (pinned): JSON-LD Product → WooCommerce summary → <h1> + price on the page
(() => {
  const squash = (v) => String(v ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const isNotFound = () => /(^|\s)(404|۴۰۴)(\s|$)|صفحه (مورد نظر )?(یافت|پیدا) نشد|page not found/i.test((document.title || "") + " " + (document.body?.innerText ?? "").slice(0, 2000));
  const isWordPress = () =>
    !!document.querySelector('link[href*="wp-content"], script[src*="wp-content"], meta[name="generator"][content*="WordPress" i]') ||
    document.body?.classList.contains("woocommerce");
  const isWoo = () => !!document.querySelector(".woocommerce, .products .product, .woocommerce-Price-amount, body.woocommerce-page");

  function onResultsPage(ctx) {
    let url = location.href;
    try {
      url = decodeURIComponent(url.replace(/\+/g, " "));
    } catch {}
    return squash(url).includes(squash(ctx.term).slice(0, 14));
  }

  function typeIntoSearchBox(term) {
    const input = [...document.querySelectorAll('input[type="search"], input[name="s"], input[name="q"], input[name*="search" i], input[id*="search" i], input[placeholder*="جستجو"], input[placeholder*="جست"]')]
      .find((el) => el.offsetParent !== null || el.getClientRects().length);
    if (!input) return false;
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, term);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (const type of ["keydown", "keypress", "keyup"]) input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    const form = input.closest("form");
    if (form) setTimeout(() => (form.requestSubmit ? form.requestSubmit() : form.submit()), 300);
    return true;
  }

  /** Lowest "… تومان" / "… ریال" in a text: [value, "IRT" | "IRR"]. */
  function priceIn(text, pk) {
    const re = /([\d۰-۹٠-٩][\d۰-۹٠-٩٬,،.\s]{2,}?)\s*(تومان|ریال|﷼)/g;
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

  /** WooCommerce price box: the sale price (<ins>) if any, else the lowest amount. */
  function wooPrice(box, pk) {
    if (!box) return null;
    const amounts = [...(box.querySelector("ins") ?? box).querySelectorAll(".woocommerce-Price-amount, .amount")];
    let best = null;
    for (const a of amounts) {
      const v = pk.parseNumber(a.innerText);
      if (!v) continue;
      const sym = a.querySelector(".woocommerce-Price-currencySymbol")?.innerText ?? a.innerText;
      const unit = /ریال|﷼|IRR/i.test(sym) ? "IRR" : "IRT";
      if (!best || v < best.value) best = { value: v, unit };
    }
    return best ?? (() => { const p = priceIn(box.innerText || "", pk); return p && { value: p.value, unit: p.unit }; })();
  }

  function wooCards(pk) {
    const cards = document.querySelectorAll("ul.products li.product, .products .product, .product-grid-item, .wd-product, .product-item, .product-box");
    const out = [];
    for (const card of cards) {
      const link = card.querySelector("a.woocommerce-LoopProduct-link, a[href*='/product/'], a[href]");
      const title = (card.querySelector(".woocommerce-loop-product__title, .product-title, .wd-entities-title, h2, h3, h4")?.innerText || link?.getAttribute("title") || "").trim();
      if (!title || !link) continue;
      const price = wooPrice(card.querySelector(".price, .product-price") ?? card, pk);
      const text = card.innerText || "";
      out.push({
        title,
        price: price?.value ?? null,
        currency: price?.unit ?? "IRT",
        url: pk.abs(link.getAttribute("href")),
        in_stock: !!price && !card.classList.contains("outofstock") && !/ناموجود|موجود نیست|تمام شد/.test(text),
        seller: "هوشمند",
        seller_count: null,
      });
      if (out.length >= 30) break;
    }
    return out;
  }

  /** Any page: group links by address, read the price from the box around each one. */
  function linkCards(pk) {
    const here = location.pathname;
    const byHref = new Map();
    for (const a of document.querySelectorAll("main a[href], #content a[href], body a[href]")) {
      let u;
      try {
        u = new URL(a.getAttribute("href"), location.href);
      } catch {
        continue;
      }
      if (u.origin !== location.origin || u.pathname === "/" || u.pathname === here || /\/(cart|checkout|my-account|tag|category|page|blog)\b/i.test(u.pathname)) continue;
      const key = u.origin + u.pathname;
      const item = byHref.get(key) ?? { key, title: "", links: [] };
      const t = (a.getAttribute("title") || a.innerText || a.querySelector("img")?.getAttribute("alt") || "").trim().split("\n")[0];
      if (t.length > item.title.length) item.title = t;
      item.links.push(a);
      byHref.set(key, item);
    }
    const out = [];
    for (const item of byHref.values()) {
      if (item.title.length < 4) continue;
      let box = item.links[0];
      for (let el = box.parentElement, d = 0; el && el !== document.body && d < 8; el = el.parentElement, d++) {
        const keys = new Set([...el.querySelectorAll("a[href]")].map((x) => { try { const u = new URL(x.getAttribute("href"), location.href); return u.origin + u.pathname; } catch { return ""; } }).filter((k) => byHref.has(k)));
        if (keys.size > 1) break;
        box = el;
      }
      const text = box.innerText || "";
      const p = priceIn(text, pk);
      if (!p) continue;
      out.push({ title: item.title, price: p.value, currency: p.unit, url: item.key, in_stock: !/ناموجود|موجود نیست|تمام شد/.test(text), seller: "هوشمند", seller_count: null });
      if (out.length >= 30) break;
    }
    return out;
  }

  function isProductPage() {
    return document.body?.classList.contains("single-product") || !!document.querySelector(".product_title, .single-product, [itemtype*='schema.org/Product']") || !!pk().productFromJsonLd();
  }
  const pk = () => globalThis.__pk;

  async function productPage(ctx, pk) {
    const ld = pk.productFromJsonLd();
    if (ld?.title && ld.price) {
      return { kind: "product", candidates: [{ ...ld, currency: pk.reconcile(ld.price, ld.currency || "IRT"), url: location.href.split("?")[0], seller: "هوشمند" }] };
    }
    const title = (document.querySelector(".product_title, h1")?.innerText || "").trim();
    const price = wooPrice(document.querySelector(".summary .price, .product-price, .price"), pk) ?? (() => { const p = priceIn(document.querySelector("main, #content, body")?.innerText ?? "", pk); return p && { value: p.value, unit: p.unit }; })();
    const out = !!document.querySelector(".stock.out-of-stock, .outofstock") || /ناموجود|موجود نیست/.test(document.querySelector(".summary, main")?.innerText ?? "");
    return { kind: "product", candidates: title ? [{ title, price: price?.value ?? null, currency: price?.unit ?? "IRT", url: location.href.split("?")[0], in_stock: !!price && !out, seller: "هوشمند", seller_count: null }] : [] };
  }

  async function searchPage(ctx, pk) {
    if (!onResultsPage(ctx)) {
      if (isWordPress() || isWoo()) {
        location.assign(`/?s=${encodeURIComponent(ctx.term)}&post_type=product`);
        return { kind: "navigating" };
      }
      if (!isNotFound() && (await pk.waitFor(() => typeIntoSearchBox(ctx.term), 6000))) return { kind: "navigating" };
      return { kind: "navigating", home: true };
    }
    // a search with one exact hit may jump straight to the product page
    if (document.body?.classList.contains("single-product")) return productPage(ctx, pk);
    const found = await pk.waitFor(() => {
      const ld = pk.findAll(pk.jsonLd(), (o) => pk.isType(o, "Product") && o.offers, 40).map((p) => {
        const o = [].concat(p.offers)[0] ?? {};
        return { title: String(p.name ?? ""), price: pk.parseNumber(o.lowPrice ?? o.price), currency: String(o.priceCurrency ?? "IRT").toUpperCase() === "IRR" ? "IRR" : "IRT", url: pk.abs(p.url ?? o.url ?? ""), in_stock: !/OutOfStock/i.test(String(o.availability ?? "")), seller: "هوشمند", seller_count: null };
      }).filter((c) => c.title);
      if (ld.some((c) => c.price)) return ld;
      const woo = wooCards(pk);
      if (woo.some((c) => c.price)) return woo;
      const links = linkCards(pk);
      return links.length ? links : null;
    }, 9000);
    if (found) return { kind: "search", candidates: found, searchUrl: location.href };
    if (isNotFound()) return { kind: "navigating", home: true };
    return { kind: "search", candidates: wooCards(pk), searchUrl: location.href };
  }

  globalThis.__pkParsers.hooshmand = (ctx, pk) => {
    // a product page that is not the result of our search (pinned link)
    if (!onResultsPage(ctx) && isProductPage()) return productPage(ctx, pk);
    return searchPage(ctx, pk);
  };
})();
