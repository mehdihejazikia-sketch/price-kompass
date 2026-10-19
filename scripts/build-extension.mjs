// Placeholder until the extension exists (stage c).
import { existsSync } from "node:fs";
if (!existsSync("extension/manifest.json")) {
  console.log("[extension] no extension yet, skipping");
  process.exit(0);
}
