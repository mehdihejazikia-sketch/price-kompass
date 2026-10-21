export const SITES = ["torob", "digikala", "emalls", "hooshmand"] as const;
export type SiteId = (typeof SITES)[number];

export const SITE_INFO: Record<SiteId, { label: string; home: string; host: string; color: string }> = {
  // chart/series colors: CSS variables (light + dark steps, colorblind-checked)
  torob: { label: "ترب", home: "https://torob.com", host: "torob.com", color: "var(--site-torob)" },
  digikala: { label: "دیجی‌کالا", home: "https://www.digikala.com", host: "digikala.com", color: "var(--site-digikala)" },
  emalls: { label: "ایمالز", home: "https://emalls.ir", host: "emalls.ir", color: "var(--site-emalls)" },
  hooshmand: { label: "هوشمند", home: "https://www.hooshmandco.com", host: "hooshmandco.com", color: "var(--site-hooshmand)" },
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
      // eMalls' own search address (seen on a real PC): …/لیست-قیمت~skey~<term>
      return `https://emalls.ir/${encodeURIComponent("لیست-قیمت")}~skey~${encodeURIComponent(term.trim().replace(/\s+/g, " "))}`;
    case "hooshmand":
      // no search results page: the site searches while you type in its search box
      return "https://www.hooshmandco.com/";
  }
}

export function isSite(s: unknown): s is SiteId {
  return typeof s === "string" && (SITES as readonly string[]).includes(s);
}

/** A pinned URL must belong to that site. */
export function urlBelongsToSite(site: SiteId, url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === SITE_INFO[site].host || h.endsWith("." + SITE_INFO[site].host);
  } catch {
    return false;
  }
}
