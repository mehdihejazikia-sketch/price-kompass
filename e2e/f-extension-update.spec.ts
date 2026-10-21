import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// an outdated extension (same ID, version 1.0.0) must get the update window
test("outdated extension: update window with download, snooze, header button", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pk-old-ext-"));
  cpSync("extension", dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ...manifest, version: "1.0.0" }));
  const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(os.tmpdir(), "pk-old-")), {
    channel: "chromium",
    headless: true,
    baseURL: "http://localhost:3100",
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  if (!ctx.serviceWorkers().length) await ctx.waitForEvent("serviceworker");
  const page = await ctx.newPage();
  await loginAs(page);
  const dialog = page.getByTestId("ext-update-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("۱.۰.۰");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "test-results/screens/ext-update.png" });
  await expect(dialog.getByRole("link", { name: "دانلود نسخه جدید" })).toHaveAttribute("href", "/api/extension/download");
  await dialog.getByRole("button", { name: "بعداً" }).click();
  await expect(dialog).toBeHidden();
  // snoozed for a day: not shown again on the next page, the header button still offers it
  await page.goto("/products");
  await expect(page.getByTestId("ext-update-chip")).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.getByTestId("ext-update-chip").click();
  await expect(dialog).toBeVisible();
  await ctx.close();
});
