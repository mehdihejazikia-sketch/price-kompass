// Packages /extension as a zip that the install page offers for download, with
// the website's own domain allowed to talk to it (externally_connectable).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { loadEnv } from "./env.mjs";

loadEnv();
const SRC = "extension";
const OUT = ".generated";

export function allowedOrigins(env = process.env) {
  const list = new Set(["http://localhost:3000", "http://localhost:3100"]);
  for (const v of [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL]) if (v) list.add(`https://${v}`);
  for (const o of (env.EXTENSION_ALLOWED_ORIGINS || "").split(",")) if (o.trim()) list.add(o.trim().replace(/\/+$/, ""));
  list.add("https://price-kompass.vercel.app");
  return [...list];
}

const manifest = JSON.parse(readFileSync(path.join(SRC, "manifest.json"), "utf8"));
manifest.externally_connectable = { matches: allowedOrigins().map((o) => `${o}/*`) };

const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/README|\.md$/.test(name)) files[path.relative(SRC, p).split(path.sep).join("/")] = new Uint8Array(readFileSync(p));
  }
})(SRC);
files["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

mkdirSync(OUT, { recursive: true });
const zipped = zipSync({ "price-kompass-extension": files }, { level: 9 });
writeFileSync(path.join(OUT, "price-kompass-extension.zip"), zipped);
console.log(`[extension] v${manifest.version} packaged for ${manifest.externally_connectable.matches.join(", ")}`);
