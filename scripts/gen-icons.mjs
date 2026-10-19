// Renders the logo to PNG icons (app + extension). Run once: node scripts/gen-icons.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const logo = (bg, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${pad ? 0 : 14}" fill="${bg}"/>
  <g transform="${pad ? "translate(9.6 9.6) scale(0.7)" : ""}">
    <circle cx="28" cy="28" r="13" fill="none" stroke="#fff" stroke-width="5"/>
    <path d="M38 38l11 11" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <path d="M22 28h12M28 22v12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </g></svg>`;

const targets = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/maskable-512.png", 512, true],
  ["public/icons/apple-touch-icon.png", 180, true],
  ["public/favicon-32.png", 32, false],
  ["extension/icons/icon-16.png", 16, false],
  ["extension/icons/icon-32.png", 32, false],
  ["extension/icons/icon-48.png", 48, false],
  ["extension/icons/icon-128.png", 128, false],
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${logo("#0f766e", pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log("icons written");
