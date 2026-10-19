"use client";

import type { SiteId } from "../sites";
import type { CheckHandlers, CheckProduct, PriceSource, SiteResult } from "./types";

export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";
export const EXTENSION_VERSION = process.env.NEXT_PUBLIC_EXTENSION_VERSION || "";

type Port = {
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: { addListener(fn: (m: Record<string, unknown>) => void): void };
  onDisconnect: { addListener(fn: () => void): void };
};
type ChromeRuntime = {
  sendMessage(id: string, msg: unknown, cb: (res: unknown) => void): void;
  connect(id: string, info?: { name?: string }): Port;
  lastError?: { message?: string };
};

function runtime(): ChromeRuntime | null {
  const c = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  // chrome.runtime only exists on our page when an extension allows this site
  return c?.runtime?.sendMessage ? c.runtime : null;
}

export type ExtensionInfo = { installed: boolean; version?: string };

export async function pingExtension(timeout = 1500): Promise<ExtensionInfo> {
  const rt = runtime();
  if (!rt || !EXTENSION_ID) return { installed: false };
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ installed: false }), timeout);
    try {
      rt.sendMessage(EXTENSION_ID, { type: "ping" }, (res) => {
        clearTimeout(t);
        void rt.lastError; // read it so Chrome doesn't log "Unchecked runtime.lastError"
        const r = res as { ok?: boolean; version?: string } | undefined;
        resolve(r?.ok ? { installed: true, version: r.version } : { installed: false });
      });
    } catch {
      clearTimeout(t);
      resolve({ installed: false });
    }
  });
}

export const extensionSource: PriceSource = {
  id: "extension",
  label: "افزونه مرورگر",
  sites: ["torob", "digikala", "emalls"],
  async available() {
    return (await pingExtension()).installed;
  },
  check(product: CheckProduct, sites: SiteId[], on: CheckHandlers, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const rt = runtime();
      if (!rt) return reject(new Error("extension missing"));
      const port = rt.connect(EXTENSION_ID, { name: "check" });
      const pending = new Set(sites);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        try {
          port.disconnect();
        } catch {}
        resolve();
      };
      signal?.addEventListener("abort", finish);
      port.onMessage.addListener((m) => {
        if (m.type === "progress") on.progress?.(m.site as SiteId);
        else if (m.type === "result") {
          const r = m.result as SiteResult;
          pending.delete(r.site);
          on.result({ ...r, source: "extension" });
        } else if (m.type === "done") finish();
      });
      port.onDisconnect.addListener(() => {
        // extension reloaded/removed mid-check
        for (const site of pending) on.result({ site, status: "error", source: "extension", message: "ارتباط با افزونه قطع شد. صفحه را دوباره بارگذاری کنید." });
        finish();
      });
      port.postMessage({ type: "check", sites, product: { name: product.name, model: product.model, search_term: product.search_term, urls: product.urls } });
    });
  },
};
