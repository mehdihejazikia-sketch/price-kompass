// Search URL per site (keep in sync with src/lib/sites.ts on the website).
export const SITES = ["torob", "digikala", "emalls", "hooshmand"];

export const LABELS = { torob: "ترب", digikala: "دیجی‌کالا", emalls: "ایمالز", hooshmand: "هوشمند" };

export function searchUrl(site, term) {
  const q = encodeURIComponent(term.trim());
  if (site === "torob") return `https://torob.com/search/?query=${q}`;
  if (site === "digikala") return `https://www.digikala.com/search/?q=${q}`;
  if (site === "hooshmand") return "https://www.hooshmandco.com/"; // site's own search box (background.js startUrl)
  // eMalls' own search address (seen on a real PC, Oct 2026)
  return `https://emalls.ir/${encodeURIComponent("لیست-قیمت")}~skey~${encodeURIComponent(term.trim().replace(/\s+/g, " "))}`;
}

export function belongsTo(site, url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    const host = { torob: "torob.com", digikala: "digikala.com", emalls: "emalls.ir", hooshmand: "hooshmandco.com" }[site];
    return h === host || h.endsWith("." + host);
  } catch {
    return false;
  }
}
