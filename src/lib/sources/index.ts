"use client";

import type { SiteId } from "../sites";
import { extensionSource } from "./extension";
import { serverSource } from "./server";
import type { CheckHandlers, CheckProduct, PriceSource } from "./types";

export type ServerSourceInfo = { id: string; label: string; sites: SiteId[] };

/** Sources in priority order: configured server APIs first, then the extension. */
export function buildSources(server: ServerSourceInfo[]): PriceSource[] {
  return [...server.map(serverSource), extensionSource];
}

/**
 * Check all sites, each with the first available source that supports it.
 * Returns the sites no source could handle (shown with the manual-search button).
 */
export async function runCheck(sources: PriceSource[], product: CheckProduct, sites: SiteId[], on: CheckHandlers, signal?: AbortSignal) {
  const avail = await Promise.all(sources.map(async (s) => ((await s.available()) ? s : null)));
  const usable = avail.filter((s): s is PriceSource => !!s);
  const plan = new Map<PriceSource, SiteId[]>();
  const unhandled: SiteId[] = [];
  for (const site of sites) {
    const src = usable.find((s) => s.sites.includes(site));
    if (!src) unhandled.push(site);
    else plan.set(src, [...(plan.get(src) ?? []), site]);
  }
  for (const [src, list] of plan) await src.check(product, list, on, signal);
  return unhandled;
}

export type { CheckProduct, PriceSource, SiteResult } from "./types";
