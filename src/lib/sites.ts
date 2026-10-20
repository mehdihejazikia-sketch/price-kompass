export const SITES = ["torob", "digikala", "emalls"] as const;
export type SiteId = (typeof SITES)[number];

export const SITE_INFO: Record<SiteId, { label: string; home: string; color: string }> = {
  // chart/series colors: CSS variables (light + dark steps, colorblind-checked)
  torob: { label: "ترب", home: "https://torob.com", color: "var(--site-torob)" },
  digikala: { label: "دیجی‌کالا", home: "https://www.digikala.com", color: "var(--site-digikala)" },
  emalls: { label: "ایمالز", home: "https://emalls.ir", color: "var(--site-emalls)" },
};

/** The site's own search page, for the manual fallback button. */
export function searchUrl(site: SiteId, term: string): string {
  const q = encodeURIComponent(term.trim());
  switch (site) {
    case "torob":
      return `https://torob.com/search/?query=${q}`;
    case "digikala":
      return `https://www.digikala.com/search/?q=${q}`;
    case "emalls":
      // eMalls' search address is not documented (the old guess gave 404): open the
      // home page; the extension searches with eMalls' own search box
      return "https://emalls.ir/";
  }
}

export function isSite(s: unknown): s is SiteId {
  return typeof s === "string" && (SITES as readonly string[]).includes(s);
}

/** A pinned URL must belong to that site. */
export function urlBelongsToSite(site: SiteId, url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return site === "torob" ? h.endsWith("torob.com") : site === "digikala" ? h.endsWith("digikala.com") : h.endsWith("emalls.ir");
  } catch {
    return false;
  }
}
