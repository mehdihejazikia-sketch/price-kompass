import "server-only";
import type { SiteId } from "@/lib/sites";
import type { SiteResult } from "@/lib/sources/types";
import type { Product } from "@/lib/products";

/**
 * Server-side price sources (official partner APIs, a search API…).
 * None is configured yet: shop sites block server requests, so prices come
 * from the browser extension. To add one, implement this interface (e.g.
 * torobPartner.ts reading TOROB_API_KEY), add it to SOURCES, and the product
 * page will use it automatically for the sites it lists, before the extension.
 */
export interface ServerPriceSource {
  id: string;
  label: string;
  sites: SiteId[];
  /** true when its credentials are configured */
  enabled(): boolean;
  check(product: Product, site: SiteId): Promise<Omit<SiteResult, "source">>;
}

const SOURCES: ServerPriceSource[] = [];

export function enabledServerSources() {
  return SOURCES.filter((s) => s.enabled());
}

export function serverSourceInfo() {
  return enabledServerSources().map(({ id, label, sites }) => ({ id, label, sites }));
}

export function findServerSource(id: string) {
  return enabledServerSources().find((s) => s.id === id) ?? null;
}
