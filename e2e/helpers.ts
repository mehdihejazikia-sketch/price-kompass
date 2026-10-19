import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, username = "admin", password = "admin12345") {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill(username);
  await page.getByLabel("رمز عبور").fill(password);
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByRole("link", { name: "قیمت‌یاب" })).toBeVisible();
}
