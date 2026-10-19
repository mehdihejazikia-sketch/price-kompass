import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// runs after c-extension.spec.ts, which saved live prices for 88724

test("product page: price chart with legend, hover tooltip and data table", async ({ page }) => {
  await loginAs(page);
  const { results } = await (await page.request.get("/api/search?q=88724")).json();
  await page.goto(`/products/${results[0].id}`);
  const chart = page.locator("section", { hasText: "روند قیمت" });
  await expect(chart.getByRole("img", { name: "نمودار روند قیمت در هر سایت" })).toBeVisible();
  for (const label of ["ترب", "دیجی‌کالا", "ایمالز"]) await expect(chart.locator("li", { hasText: label })).toBeVisible();
  const svg = chart.getByRole("img");
  await svg.scrollIntoViewIfNeeded();
  const b = (await svg.boundingBox())!;
  await page.mouse.move(b.x + b.width - 90, b.y + b.height / 2);
  await expect(chart.getByTestId("chart-tooltip")).toContainText("۴٬۷۵۰٬۰۰۰ تومان");
  await chart.getByText(/جدول داده‌ها/).click();
  await expect(chart.locator("table tbody tr").first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/screens/product-chart.png", fullPage: true });
});

test("history page and recent checks on the home page", async ({ page }) => {
  await loginAs(page);
  await page.goto("/history");
  await expect(page.locator("tbody tr").first()).toContainText("GDM-248CS");
  await page.getByRole("link", { name: "دیجی‌کالا" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("۴٬۷۵۰٬۰۰۰ تومان");
  await page.goto("/");
  await expect(page.getByText("آخرین استعلام‌ها")).toBeVisible();
  await expect(page.locator("section", { hasText: "آخرین استعلام‌ها" })).toContainText("GDM-248CS");
});

test("installable PWA: public manifest, icons and an active service worker", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({ name: "قیمت‌یاب", dir: "rtl", lang: "fa", display: "standalone", start_url: "/" });
  for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/sw.js")).status()).toBe(200);
  await loginAs(page);
  await page.goto("/");
  const active = await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
  expect(active).toBe(true);
  // private data is never cached: the page still requires a login
  expect((await request.get("/api/products")).status()).toBe(401);
});
