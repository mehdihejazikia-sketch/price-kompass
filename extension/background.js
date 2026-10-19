// قیمت‌یاب browser extension: reads prices the way a person would.
// The website sends one product; for each site, one at a time, we open the
// site's search page (or the pinned product page) in a background tab, read
// the price from the page, close the tab and send the result back.
import { SITES, LABELS, searchUrl, belongsTo } from "./sites.js";
import { pickBest } from "./match.js";

const VERSION = chrome.runtime.getManifest().version;
const PAGE_TIMEOUT = 25000;

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
      for (const site of sites) {
        if (cancelled) return;
        safePost(port, { type: "progress", site, state: "checking" });
        const result = await checkSite(site, msg.product ?? {});
        if (cancelled) return;
        safePost(port, { type: "result", result });
      }
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
  const pinned = product.urls?.[site] && belongsTo(site, product.urls[site]) ? product.urls[site] : null;
  const pageUrl = pinned || searchUrl(site, term);
  const base = { site, page_url: pageUrl, pinned: !!pinned, checked_at: new Date().toISOString() };
  if (!term && !pinned) return { ...base, status: "error", message: "عبارت جستجو برای این کالا خالی است." };

  let tabId;
  try {
    const tab = await chrome.tabs.create({ url: pageUrl, active: false });
    tabId = tab.id;
    await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
    const parsed = await readTab(tabId, site, { term, model: product.model || "" });
    if (parsed.error) return { ...base, status: "error", message: `خواندن صفحه ${LABELS[site]} ممکن نشد. (${parsed.error})` };
    if (parsed.blocked) return { ...base, status: "error", message: parsed.blocked };
    const candidates = parsed.candidates ?? [];
    if (!candidates.length) {
      return { ...base, status: "not_found", message: parsed.kind === "product" ? "قیمت در صفحه کالا پیدا نشد." : `کالایی با «${term}» در ${LABELS[site]} پیدا نشد.` };
    }
    const best = parsed.kind === "product" ? { ...candidates[0], match: "pinned" } : pickBest(candidates, product);
    if (!best) return { ...base, status: "not_found", message: "نتیجه‌ای پیدا نشد." };
    const currency = best.currency === "IRR" ? "IRR" : "IRT";
    const price_toman = best.price ? (currency === "IRR" ? Math.round(best.price / 10) : best.price) : null;
    return {
      ...base,
      status: price_toman ? "ok" : "not_found",
      message: price_toman ? null : "کالا پیدا شد ولی قیمت ندارد (احتمالاً ناموجود).",
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

/** Inject the parser and run it; retry if the page navigated (bot checks, redirects). */
async function readTab(tabId, site, ctx) {
  const deadline = Date.now() + PAGE_TIMEOUT;
  let last = { error: "timeout" };
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    await waitComplete(tabId, Math.max(1000, deadline - Date.now()));
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["parsers/common.js", `parsers/${site}.js`] });
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (s, c) => globalThis.__pkRun(s, c),
        args: [site, ctx],
      });
      last = res?.result ?? { error: "no result" };
      if (!last.error) return last;
    } catch (e) {
      last = { error: String(e?.message || e) };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return last;
}
