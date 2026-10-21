// قیمت‌یاب browser extension: reads prices the way a person would.
// The website sends one product; for every site at once we open the site's
// search page (or the pinned product page) in its own background tab, read the
// price from the page, close the tab and send each result back as it arrives.
import { SITES, LABELS, searchUrl, belongsTo } from "./sites.js";
import { compact, isSpecLike, pickBest } from "./match.js";

const VERSION = chrome.runtime.getManifest().version;
const PAGE_TIMEOUT = 35000;

// One check at a time (no bulk scraping); later requests wait their turn.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  if (msg?.type === "ping") {
    reply({ ok: true, version: VERSION, sites: SITES });
    return;
  }
  reply({ ok: false, error: "unknown message" });
});

chrome.runtime.onConnectExternal.addListener((port) => {
  let cancelled = false;
  port.onDisconnect.addListener(() => (cancelled = true));
  port.onMessage.addListener((msg) => {
    if (msg?.type !== "check") return;
    serial(async () => {
      const sites = (msg.sites ?? SITES).filter((s) => SITES.includes(s));
      // all sites at the same time, each in its own background tab; every result is
      // sent as soon as that site is done. (One product at a time: the queue above.)
      await Promise.all(
        sites.map(async (site, i) => {
          await new Promise((r) => setTimeout(r, i * 250)); // open the tabs a moment apart
          if (cancelled) return;
          safePost(port, { type: "progress", site, state: "checking" });
          const result = await checkSite(site, msg.product ?? {});
          if (!cancelled) safePost(port, { type: "result", result });
        }),
      );
      safePost(port, { type: "done" });
    });
  });
});

function safePost(port, m) {
  try {
    port.postMessage(m);
  } catch {}
}

/** Popup "test" button also uses this (internal message). */
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "test-check") {
    serial(() => checkSite(msg.site, msg.product)).then(reply);
    return true;
  }
});

export async function checkSite(site, product) {
  const term = String(product.search_term || product.model || product.name || "").trim();
  // the model code (NK8800, GDM-248CS…) for a second search; also found in the term itself
  const rawModel = String(product.model || (term.match(/[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*\d[A-Za-z0-9-]*|[A-Za-z0-9]*\d[A-Za-z0-9]*[A-Za-z][A-Za-z0-9-]*/) ?? [""])[0]).trim();
  const model = isSpecLike(rawModel) ? "" : rawModel; // «1.5m» is a length, not a model code
  const pinned = product.urls?.[site] && belongsTo(site, product.urls[site]) ? product.urls[site] : null;
  const pageUrl = pinned || (await startUrl(site, term));
  const base = { site, page_url: pageUrl, pinned: !!pinned, checked_at: new Date().toISOString() };
  if (!term && !pinned) return { ...base, status: "error", message: "عبارت جستجو برای این کالا خالی است." };

  let tabId;
  try {
    const tab = await chrome.tabs.create({ url: pageUrl, active: false });
    tabId = tab.id;
    await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
    let parsed = await readTab(tabId, site, { term, model, pinned: !!pinned });
    if (LEARNED.includes(site) && !pinned) await learnSearchUrl(site, parsed, term);
    let usedTerm = term;
    // Nothing (or nothing that fits) for the full name? Shops spell names differently
    // («کیبرد» / «کیبورد», «رپو» / «Rapoo»), so search once more with the model code alone.
    if (!pinned && model && compact(model) !== compact(term) && !parsed.error && !parsed.blocked && parsed.kind !== "product") {
      const first = parsed.candidates ?? [];
      if (!first.length || pickBest(first, product)?.match === "weak") {
        await chrome.tabs.update(tabId, { url: await startUrl(site, model) });
        await new Promise((r) => setTimeout(r, 800));
        const retry = await readTab(tabId, site, { term: model, model, pinned: false });
        const retryCands = retry.candidates ?? [];
        if (!retry.error && !retry.blocked && retryCands.length && (!first.length || pickBest(retryCands, product)?.match !== "weak")) {
          parsed = retry;
          usedTerm = model;
        }
      }
    }
    // the site gave only product titles + addresses (a search-as-you-type list):
    // open the best-matching product page and read the price there
    if (parsed.kind === "links") {
      const links = parsed.candidates ?? [];
      const listDebug = parsed.debug;
      const pick = pickBest(links, product);
      if (pick && (pick.url || pick.index !== undefined)) {
        const before = (await chrome.tabs.get(tabId)).url;
        if (pick.url) await chrome.tabs.update(tabId, { url: pick.url });
        else {
          await chrome.scripting.executeScript({ target: { tabId }, func: (i) => globalThis.__pkClickItem?.(i), args: [pick.index] });
          // a click in a single-page site changes the address without a full reload
          for (let t = 0; t < 40 && (await chrome.tabs.get(tabId)).url === before; t++) await new Promise((r) => setTimeout(r, 200));
        }
        await new Promise((r) => setTimeout(r, 1200));
        const page = await readTab(tabId, site, { term: usedTerm, model, pinned: true });
        const c = page.candidates?.[0];
        const url = (await chrome.tabs.get(tabId)).url;
        parsed = c
          ? { kind: "search", candidates: [{ ...c, url: pick.url || url, title: c.title || pick.title }], debug: c.price ? undefined : page.debug }
          : { kind: "search", candidates: links, debug: page.debug ?? listDebug };
      } else {
        parsed = { kind: "search", candidates: links, debug: listDebug };
      }
    }
    if (parsed.error) return { ...base, status: "error", message: `خواندن صفحه ${LABELS[site]} ممکن نشد. (${parsed.error})` };
    if (parsed.blocked) return { ...base, status: "error", message: parsed.blocked };
    const candidates = parsed.candidates ?? [];
    if (!candidates.length) {
      const tried = model && compact(model) !== compact(term) ? `«${term}» و «${model}»` : `«${term}»`;
      return { ...base, status: "not_found", message: parsed.kind === "product" ? "قیمت در صفحه کالا پیدا نشد." : `کالایی با ${tried} در ${LABELS[site]} پیدا نشد.`, debug: parsed.debug };
    }
    base.search_term = usedTerm;
    let best = parsed.kind === "product" ? { ...candidates[0], match: "pinned" } : pickBest(candidates, product);
    if (!best) return { ...base, status: "not_found", message: "نتیجه‌ای پیدا نشد." };
    // The right product is in the results but its price isn't shown there (eMalls'
    // result cards, search-as-you-type lists…): open the product page and read it there.
    if (parsed.kind !== "product" && !best.price && best.url) {
      await chrome.tabs.update(tabId, { url: best.url });
      await new Promise((r) => setTimeout(r, 800));
      const page = await readTab(tabId, site, { term: usedTerm, model, pinned: true });
      const c = page.candidates?.[0];
      if (c?.price) {
        const enriched = { ...best, price: c.price, currency: c.currency, in_stock: c.in_stock, seller: c.seller ?? best.seller, seller_count: c.seller_count ?? best.seller_count };
        // the website re-checks the candidates, so the enriched one must be in the list
        for (let i = 0; i < candidates.length; i++) if (candidates[i].url === best.url) candidates[i] = { ...candidates[i], ...enriched };
        best = enriched;
      } else if (page.debug) {
        parsed.debug = page.debug;
      }
    }
    const currency = best.currency === "IRR" ? "IRR" : "IRT";
    const price_toman = best.price ? (currency === "IRR" ? Math.round(best.price / 10) : best.price) : null;
    return {
      ...base,
      status: price_toman ? "ok" : "not_found",
      message: price_toman ? null : "کالا پیدا شد ولی قیمت ندارد (احتمالاً ناموجود).",
      debug: price_toman ? undefined : parsed.debug,
      title: best.title,
      price: best.price,
      currency,
      price_toman,
      url: best.url || pageUrl,
      in_stock: price_toman ? best.in_stock !== false : false,
      seller: best.seller ?? null,
      seller_count: best.seller_count ?? null,
      match: best.match,
      // all results, so the website can re-check the choice with its own matcher
      candidates: candidates.slice(0, 12).map(({ title, price, currency, url, in_stock, seller, seller_count }) => ({ title, price, currency, url, in_stock, seller, seller_count })),
      kind: parsed.kind,
    };
  } catch (e) {
    return { ...base, status: "error", message: `باز کردن ${LABELS[site]} ممکن نشد. (${e?.message || e})` };
  } finally {
    if (tabId !== undefined) chrome.tabs.remove(tabId).catch(() => {});
  }
}

function waitComplete(tabId, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpd);
      clearTimeout(t);
      resolve(v);
    };
    const onUpd = (id, info) => id === tabId && info.status === "complete" && finish(true);
    const t = setTimeout(() => finish(false), timeout);
    chrome.tabs.onUpdated.addListener(onUpd);
    chrome.tabs.get(tabId).then((tab) => tab.status === "complete" && finish(true)).catch(() => finish(false));
  });
}

const HOME = { torob: "https://torob.com/", digikala: "https://www.digikala.com/", emalls: "https://emalls.ir/", hooshmand: "https://www.hooshmandco.com/" };
// sites whose search address is learned (first search through their search box)
const LEARNED = ["emalls", "hooshmand"];
const tplKey = (site) => (site === "emalls" ? "emallsSearch" : `searchTpl:${site}`);

/**
 * Where a search starts. eMalls' search address isn't documented: the first
 * search goes through its search box, then the address is remembered as a
 * template ({ base, sep }) in chrome.storage.
 */
async function startUrl(site, term) {
  if (!LEARNED.includes(site)) return searchUrl(site, term);
  const saved = (await chrome.storage.local.get(tplKey(site)))[tplKey(site)];
  if (saved?.template) {
    const q = term.trim().split(/\s+/).map(encodeURIComponent).join(saved.sep || "%20");
    return saved.template.replace("{q}", q);
  }
  // eMalls' search address is known now (…/لیست-قیمت~skey~…); others start at the home page
  return site === "emalls" ? searchUrl(site, term) : HOME[site];
}

async function learnSearchUrl(site, parsed, term) {
  // only an address that really showed results is remembered
  if (parsed?.kind !== "search" || !parsed.searchUrl || !parsed.candidates?.length) return;
  const url = parsed.searchUrl;
  const words = term.trim().split(/\s+/).map(encodeURIComponent);
  for (const sep of ["%20", "+", "-", "_"]) {
    const enc = words.join(sep);
    for (const variant of [enc, enc.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())]) {
      const i = url.indexOf(variant);
      if (i >= 0) {
        await chrome.storage.local.set({ [tplKey(site)]: { template: url.slice(0, i) + "{q}" + url.slice(i + variant.length), sep } });
        return;
      }
    }
  }
}

/** Inject the parser and run it; retry if the page navigated (bot checks, redirects). */
async function readTab(tabId, site, ctx) {
  const deadline = Date.now() + PAGE_TIMEOUT;
  let last = { error: "timeout" };
  for (let attempt = 0; attempt < 5 && Date.now() < deadline; attempt++) {
    await waitComplete(tabId, Math.max(1000, deadline - Date.now()));
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["parsers/common.js", `parsers/${site}.js`] });
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (s, c) => globalThis.__pkRun(s, c),
        args: [site, { ...ctx, attempt }],
      });
      last = res?.result ?? { error: "no result" };
      if (last.kind === "navigating") {
        // the parser typed into the site's search box, or asked to start from the home page
        if (last.home) {
          if (LEARNED.includes(site)) await chrome.storage.local.remove(tplKey(site));
          await chrome.tabs.update(tabId, { url: HOME[site] });
        }
        last = { error: "search did not open" };
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (!last.error) return last;
    } catch (e) {
      last = { error: String(e?.message || e) };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return last;
}
