"use client";

import { apiFetch } from "../client";
import type { SiteId } from "../sites";
import type { PriceSource, SiteResult } from "./types";

/**
 * Wraps a source that runs on our server (an official partner API or a search
 * API, see src/lib/server/sources). The server registry tells the page which
 * ones are configured; the UI treats them exactly like the extension.
 */
export function serverSource(info: { id: string; label: string; sites: SiteId[] }): PriceSource {
  return {
    ...info,
    available: async () => true,
    async check(product, sites, on, signal) {
      for (const site of sites) {
        if (signal?.aborted) return;
        on.progress?.(site);
        try {
          const r = await apiFetch<SiteResult>(`/api/sources/${info.id}/check`, { method: "POST", json: { productId: product.id, site }, signal });
          on.result({ ...r, source: info.id });
        } catch (e) {
          on.result({ site, status: "error", source: info.id, message: (e as Error).message });
        }
      }
    },
  };
}
