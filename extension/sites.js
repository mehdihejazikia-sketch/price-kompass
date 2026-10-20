// Search URL per site (keep in sync with src/lib/sites.ts on the website).
export const SITES = ["torob", "digikala", "emalls"];

export const LABELS = { torob: "ترب", digikala: "دیجی‌کالا", emalls: "ایمالز" };

export function searchUrl(site, term) {
  const q = encodeURIComponent(term.trim());
  if (site === "torob") return `https://torob.com/search/?query=${q}`;
  if (site === "digikala") return `https://www.digikala.com/search/?q=${q}`;
  return "https://emalls.ir/"; // searched through the site's search box (background.js startUrl)
}

export function belongsTo(site, url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return site === "torob" ? h.endsWith("torob.com") : site === "digikala" ? h.endsWith("digikala.com") : h.endsWith("emalls.ir");
  } catch {
    return false;
  }
}
