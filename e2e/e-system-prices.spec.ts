import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

const FILE = "samples/products-prices.xlsx";

test.skip(!existsSync(FILE), "needs the real price-board file in samples/");

test("price-board file: one-click import, own prices shown above the shop prices", async ({ page }) => {
  await loginAs(page);
  await page.goto("/import");
  await page.getByTestId("file-input").setInputFiles({
    name: "تابلو قیمت.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: readFileSync(FILE),
  });
  await expect(page.getByTestId("import-preview")).toBeVisible();
  await expect(page.getByTestId("price-unit")).toContainText("ریال");
  await expect(page.getByTestId("price-unit")).toContainText("تاریخ فایل");
  await expect(page.getByTestId("count-price_changed")).toBeVisible();
  await page.getByRole("button", { name: "ثبت در فهرست کالاها" }).click();
  await expect(page.getByTestId("import-result")).toBeVisible({ timeout: 30000 });

  // the format is remembered: the next upload goes straight to the preview again
  await page.goto("/import");
  await page.getByTestId("file-input").setInputFiles({ name: "again.xlsx", mimeType: "application/octet-stream", buffer: readFileSync(FILE) });
  await expect(page.getByTestId("count-price_changed")).toContainText("۰");

  const { results } = await (await page.request.get("/api/search?q=3560013")).json();
  await page.goto(`/products/${results[0].id}`);
  await expect(page.getByTestId("level1")).toHaveText("۱٬۶۵۰٬۰۰۰ تومان");
  const own = (await page.getByTestId("system-prices").boundingBox())!;
  const shops = (await page.getByTestId("price-table").boundingBox())!;
  expect(own.y).toBeLessThan(shops.y);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/screens/system-prices.png" });
});
