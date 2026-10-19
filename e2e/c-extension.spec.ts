import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { chromiumArgs, startShopServer, type ShopServer } from "./fixtures/shop-server";
import { loginAs } from "./helpers";

const EXT = path.resolve("extension");

let ctx: BrowserContext;
let shops: ShopServer;

test.beforeAll(async () => {
  shops = await startShopServer();
  ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(os.tmpdir(), "pk-ext-")), {
    channel: "chromium",
    headless: true,
    baseURL: "http://localhost:3100",
    locale: "fa-IR",
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...chromiumArgs()],
  });
  // wait for the extension's service worker
  if (!ctx.serviceWorkers().length) await ctx.waitForEvent("serviceworker");
});

test.afterAll(async () => {
  await ctx?.close();
  await shops?.close();
});

async function openTestProduct() {
  const page = await ctx.newPage();
  await loginAs(page);
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "جستجوی کالا" });
  await box.fill("88724");
  await expect(page.getByRole("option").first()).toContainText("GDM-248CS");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/products\/\d+$/);
  return page;
}

test("install page detects the extension", async () => {
  const page = await ctx.newPage();
  await loginAs(page);
  await page.goto("/extension");
  await expect(page.getByTestId("ext-status")).toContainText("افزونه نصب و فعال است");
  await page.close();
});

test("live check for 88724 (GDM-248CS) on torob, digikala and emalls", async () => {
  const page = await openTestProduct();
  // check starts automatically
  await expect(page.getByTestId("price-torob")).toHaveText("۴٬۵۹۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(page.getByTestId("price-digikala")).toHaveText("۴٬۷۵۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(page.getByTestId("price-emalls")).toHaveText("۴٬۶۲۰٬۰۰۰ تومان", { timeout: 45000 });

  const torob = page.getByTestId("row-torob");
  await expect(torob).toContainText("GDM-248CS"); // found title, the right model (not GDM-278LN)
  await expect(torob).toContainText("مدل مطابقت دارد");
  await expect(torob).toContainText("۱۲ فروشنده");
  await expect(torob).toContainText("کمترین قیمت");
  await expect(page.getByTestId("row-digikala")).toContainText("۴۷٬۵۰۰٬۰۰۰ ریال"); // Rial shown, converted to Toman
  await expect(page.getByTestId("row-emalls")).toContainText("۵ فروشنده");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/screens/product-light.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "test-results/screens/product-dark.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  // one site at a time, search pages only, every tab closed again
  await expect.poll(() => ctx.pages().filter((p) => /torob|digikala|emalls/.test(p.url())).length).toBe(0);

  // confirm Torob's product → pinned; the next check opens that product page directly
  await torob.getByRole("button", { name: "این کالای درست است" }).click();
  await expect(torob).toContainText("لینک ثابت");
  shops.opened.length = 0;
  await page.getByRole("button", { name: "بررسی دوباره" }).click();
  await expect(page.getByTestId("price-torob")).toHaveText("۴٬۴۹۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(torob).toContainText("۲ فروشنده");
  expect(shops.opened.some((u) => u.startsWith("https://torob.com/p/abc-123/"))).toBe(true);
  await expect(page.getByTestId("price-emalls")).toBeVisible({ timeout: 45000 });

  // last known prices show instantly on the next visit
  await page.reload();
  await expect(page.getByTestId("row-digikala")).toContainText("۴٬۷۵۰٬۰۰۰ تومان");
  await page.close();
});

test("a blocked site shows a Farsi message and a manual search button", async () => {
  shops.state.emallsBlocked = true;
  const page = await openTestProduct();
  await expect(page.getByTestId("error-emalls")).toContainText("ربات نیستم", { timeout: 60000 });
  const manual = page.getByTestId("row-emalls").getByRole("link", { name: "جستجو در ایمالز" });
  await expect(manual).toHaveAttribute("href", /emalls\.ir/);
  await expect(manual).toHaveAttribute("target", "_blank");
  shops.state.emallsBlocked = false;
  await page.close();
});

test("without the extension: clear message, last prices and manual buttons", async ({ browser }) => {
  const c = await browser.newContext({ baseURL: "http://localhost:3100" });
  const page = await c.newPage();
  await loginAs(page);
  await page.goto("/");
  await page.getByRole("combobox", { name: "جستجوی کالا" }).fill("88724");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ext-missing")).toBeVisible();
  await expect(page.getByTestId("row-torob")).toContainText("آخرین قیمت ثبت‌شده");
  await expect(page.getByTestId("row-digikala").getByRole("link", { name: "جستجو در دیجی‌کالا" })).toHaveAttribute("href", /digikala\.com\/search\/\?q=GDM-248CS/);
  await c.close();
});
