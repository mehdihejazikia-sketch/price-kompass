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
  // like the real PC: an old, wrong search address learned by 1.3.x must be dropped
  const sw = ctx.serviceWorkers()[0];
  await sw.evaluate(() =>
    chrome.storage.local.set({ "searchTpl:hooshmand": { template: "https://www.hooshmandco.com/index.php?route=product/search&search={q}", sep: "%20" } }),
  );
  const page = await openTestProduct();
  // check starts automatically
  await expect(page.getByTestId("price-torob")).toHaveText("۴٬۵۹۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(page.getByTestId("price-digikala")).toHaveText("۴٬۷۵۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(page.getByTestId("price-emalls")).toHaveText("۴٬۶۲۰٬۰۰۰ تومان", { timeout: 45000 });
  // hooshmandco.com: search-as-you-type list → the right product's page → its (discounted) price
  await expect(page.getByTestId("price-hooshmand")).toHaveText("۴٬۵۰۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(page.getByTestId("row-hooshmand")).toContainText("GDM-248CS");
  // the full Persian name found nothing in the list, the model code did; then its page was opened
  expect(shops.opened.some((u) => u === "https://www.hooshmandco.com/gplus-gdm-248cs")).toBe(true);
  expect(await sw.evaluate(() => chrome.storage.local.get("searchTpl:hooshmand"))).toEqual({});

  // order: Digikala, Torob, eMalls, Hooshmand
  const order = await page.locator("[data-testid^=row-]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-testid")));
  expect(order).toEqual(["row-digikala", "row-torob", "row-emalls", "row-hooshmand"]);
  const torob = page.getByTestId("row-torob");
  await expect(torob).toContainText("GDM-248CS"); // found title, the right model (not GDM-278LN)
  await expect(torob).toContainText("کالا مطابقت دارد");
  await expect(torob).toContainText("۱۲ فروشنده");
  await expect(page.getByTestId("row-hooshmand")).toContainText("کمترین قیمت");
  await expect(page.getByTestId("row-digikala")).toContainText("۴۷٬۵۰۰٬۰۰۰ ریال"); // Rial shown, converted to Toman
  await expect(page.getByTestId("row-emalls")).toContainText("۵ فروشنده");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/screens/product-light.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "test-results/screens/product-dark.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  // all four sites were opened at the same time (not one after another)
  const starts = ["torob.com", "www.digikala.com", "emalls.ir", "www.hooshmandco.com"].map((h) => shops.firstHit[h]);
  expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(3000);
  // every tab closed again
  await expect.poll(() => ctx.pages().filter((p) => /torob|digikala|emalls/.test(p.url())).length).toBe(0);

  // confirm Torob's product → pinned; the next check opens that product page directly
  await torob.getByRole("button", { name: "این کالای درست است" }).click();
  await expect(torob).toContainText("لینک ثابت");
  shops.opened.length = 0;
  await page.getByRole("button", { name: "بررسی دوباره" }).click();
  await expect(page.getByTestId("price-torob")).toHaveText("۴٬۴۹۰٬۰۰۰ تومان", { timeout: 45000 });
  await expect(torob).toContainText("۲ فروشنده");
  expect(shops.opened.some((u) => u.startsWith("https://torob.com/p/abc-123/"))).toBe(true);
  // Hooshmand: a pinned product page (OpenCart /slug) is read as the product, not as a search
  const pid = Number(new URL(page.url()).pathname.split("/").pop());
  await page.request.post(`/api/products/${pid}/pin`, { data: { site: "hooshmand", url: "https://www.hooshmandco.com/gplus-gdm-248cs" } });
  await page.reload();
  await page.getByRole("button", { name: "بررسی دوباره" }).click();
  await expect(page.getByTestId("price-hooshmand")).toHaveText("۴٬۵۰۰٬۰۰۰ تومان", { timeout: 45000 });
  // eMalls: the first check went through its search box; now the learned address is opened directly
  // eMalls: its own ~skey~ search address, then the product page because the cards show no price
  await expect.poll(() => shops.opened.some((u) => decodeURIComponent(u).includes("~skey~")), { timeout: 45000 }).toBe(true);
  await expect.poll(() => shops.opened.some((u) => decodeURIComponent(u).includes("~id~555")), { timeout: 45000 }).toBe(true);
  expect(shops.opened.some((u) => u === "https://emalls.ir/")).toBe(false);
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
  await expect(page.getByTestId("row-digikala").getByRole("link", { name: "جستجو در دیجی‌کالا" })).toHaveAttribute("href", /digikala\.com\/search\/\?q=.*GDM-248CS/);
  await c.close();
});
