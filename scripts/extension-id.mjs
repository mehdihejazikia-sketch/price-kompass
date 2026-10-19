// The extension ID follows from the public key in manifest.json ("key"), so it
// is the same on every computer, also for "Load unpacked".
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function extensionId(manifestPath = "extension/manifest.json") {
  const { key } = JSON.parse(readFileSync(manifestPath, "utf8"));
  const hex = createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32);
  return [...hex].map((h) => String.fromCharCode(97 + parseInt(h, 16))).join("");
}

export function extensionVersion(manifestPath = "extension/manifest.json") {
  return JSON.parse(readFileSync(manifestPath, "utf8")).version;
}
