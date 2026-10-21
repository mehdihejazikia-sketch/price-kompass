// emalls.ir. Prices are shown in Toman.
// Product page …~id~<n>: JSON-LD Product with AggregateOffer (lowPrice, offerCount) → page text.
// Search: we open the home page and use eMalls' own search box (its address format is not
// documented); the results address is then remembered by background.js for next time.
// Results: item links on the page → the list the page loads from /_Search.ashx.
(() => {
  const itemId = (href) => /~id~(\d+)/i.exec(decodeURIComponent(href || ""))?.[1] ?? null;

  /** Lowest "… تومان" (or Rial ÷ 10) in a piece of text. */
  function priceIn(text, pk) {
    const re = /([\d۰-۹٠-٩][\d۰-۹٠-٩٬,،.٫]{2,})\s*(تومان|ریال)/g;
    let best = null;
    let m;
    while ((m = re.exec(text))) {
      let v = pk.parseNumber(m[1]);
      if (!v || v < 1000) continue;
      if (m[2] === "ریال") v = Math.round(v / 10);
      if (best === null || v < best) best = v;
    }
    return best;
  }

  /**
   * One candidate per item (…~id~123). The price is not inside the link, so
   * walk up from the link to the biggest box that still belongs to this item
   * only (no links to other items) and read the price from there.
   */
  function domCandidates(pk) {
    const byId = new Map();
    for (const a of document.querySelectorAll('a[href*="~id~" i]')) {
      const id = itemId(a.getAttribute("href"));
      if (!id) continue;
      const item = byId.get(id) ?? { id, href: a.getAttribute("href"), title: "", links: [] };
      const t = (a.getAttribute("title") || a.innerText || a.querySelector("img")?.getAttribute("alt") || "").trim().split("\n")[0];
      if (t.length > item.title.length) item.title = t;
      item.links.push(a);
      byId.set(id, item);
      if (byId.size >= 40) break;
    }
    const out = [];
    for (const item of byId.values()) {
      if (item.title.length < 3) continue;
      let box = item.links[0];
      for (let el = box.parentElement, depth = 0; el && el !== document.body && depth < 8; el = el.parentElement, depth++) {
        const ids = new Set([...el.querySelectorAll('a[href*="~id~" i]')].map((x) => itemId(x.getAttribute("href"))));
        if (ids.size > 1) break;
        box = el;
      }
      const text = box.innerText || "";
      const fromBox = pk.boxPrices(box).map((p) => (p.unit === "IRR" ? Math.round(p.value / 10) : p.value));
      const price = priceIn(text, pk) ?? (fromBox.length ? Math.min(...fromBox) : null);
      const shops = /(\d+)\s*(فروشگاه|فروشنده)/.exec(pk.toLatin(text));
      out.push({
        title: item.title,
        price,
        currency: "IRT",
        url: pk.abs(item.href),
        in_stock: !!price && !/ناموجود|موجود نیست|عدم موجودی/.test(text),
        seller_count: shops ? Number(shops[1]) : null,
        seller: null,
      });
      if (out.length >= 30) break;
    }
    return out;
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

  /** Lowest price on an eMalls product page; the page lists one price per shop. */
  function pagePrice(pk) {
    const toToman = (p) => (p.unit === "IRR" ? Math.round(p.value / 10) : p.value);
    // «کمترین قیمت: ۲٬۴۵۰٬۰۰۰» / «قیمت از ۲٬۴۵۰٬۰۰۰»
    const text = pk.toLatin(document.body?.innerText ?? "");
    const lead = /(کمترین قیمت|قیمت از|شروع قیمت|ارزان ?ترین)\s*:?\s*(\d{1,3}(?:[٬,،.٫]\d{3})+|\d{5,})\s*(تومان|ریال)?/.exec(text);
    if (lead) {
      const v = pk.parseNumber(lead[2]);
      if (v) return lead[3] === "ریال" ? Math.round(v / 10) : v;
    }
    const shown = pk.visiblePrices().map(toToman);
    const boxes = pk.boxPrices().map(toToman);
    const all = [...shown, ...boxes].filter((v) => v >= 1000);
    return all.length ? Math.min(...all) : null;
  }

  async function productPage(ctx, pk) {
    // the page may fill in prices a moment after loading
    await pk.waitFor(() => pk.productFromJsonLd()?.price || pk.visiblePrices().length || pk.boxPrices().length, 8000);
    const url = location.href.split("?")[0];
    const ld = pk.productFromJsonLd();
    if (ld?.title && ld.price) return { kind: "product", candidates: [{ ...ld, currency: pk.reconcile(ld.price, ld.currency || "IRT"), url }] };
    // JSON-LD without a price (or none): read the prices shown on the page
    const title = (document.querySelector("h1")?.innerText || ld?.title || "").trim();
    const price = pagePrice(pk);
    const text = document.body?.innerText ?? "";
    const shops = /(\d+)\s*(فروشگاه|فروشنده)/.exec(pk.toLatin(text));
    if (!title) return { kind: "product", candidates: [] };
    return {
      kind: "product",
      candidates: [{ title, price, currency: "IRT", url, in_stock: !!price && !/^\s*ناموجود/.test(text), seller: null, seller_count: ld?.seller_count ?? (shops ? Number(shops[1]) : null) }],
    };
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
    // prices may appear a moment after the result links: wait for them
    let dom = await pk.waitFor(() => { const c = domCandidates(pk); return c.some((x) => x.price) ? c : null; }, 9000);
    if (!dom) dom = domCandidates(pk);
    if (dom.some((c) => c.price)) return { kind: "search", candidates: dom, searchUrl: location.href };
    // no prices on the page: the result list the page itself loads, merged with the links found
    try {
      const body = new URLSearchParams({ entekhab: "listitemv2", currenturl: location.href, findstr: ctx.term, pagenum: "1", sort: "", exist: "", shop: "0", minprice: "0", maxprice: "0" });
      const data = await pk.fetchJson("/_Search.ashx", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const items = data?.lstsearchresualt || data?.lstsearchresult || [];
      if (Array.isArray(items) && items.length) {
        const api = items.slice(0, 30).map((it) => fromAshxItem(it, pk)).filter((c) => c.title);
        return { kind: "search", candidates: api.concat(dom.filter((d) => !api.some((a) => a.url && a.url === d.url))), searchUrl: location.href };
      }
    } catch {}
    if (dom.length) return { kind: "search", candidates: dom, searchUrl: location.href };
    if (isNotFound()) return { kind: "navigating", home: true };
    return { kind: "search", candidates: [], searchUrl: location.href };
  }

  globalThis.__pkParsers.emalls = (ctx, pk) => (/~id~/i.test(decodeURIComponent(location.pathname)) ? productPage(ctx, pk) : searchPage(ctx, pk));
})();
