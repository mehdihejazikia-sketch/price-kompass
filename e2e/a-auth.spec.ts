import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("private pages redirect to login, RTL Farsi layout", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login\?next=%2Fusers/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  const api = await page.request.get("/api/users");
  expect(api.status()).toBe(401);
});

test("wrong password shows Farsi error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill("admin");
  await page.getByLabel("رمز عبور").fill("wrong-password");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("نام کاربری یا رمز عبور اشتباه است.");
});

test("admin creates a user; the user signs in and cannot see admin pages", async ({ page, browser }) => {
  await loginAs(page);
  await page.getByRole("link", { name: "کاربران" }).click();
  await page.locator('input[name="username"]').fill("sara");
  await page.locator('input[name="display_name"]').fill("سارا");
  await page.locator('input[name="password"]').fill("sara-pass-1");
  await page.getByRole("button", { name: "ساخت کاربر" }).click();
  await expect(page.getByText("کاربر «sara» ساخته شد.")).toBeVisible();

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await loginAs(p2, "sara", "sara-pass-1");
  await expect(p2.getByRole("link", { name: "کاربران" })).toHaveCount(0);
  await p2.goto("/users");
  await expect(p2).toHaveURL(/\/$/);
  expect((await p2.request.get("/api/users")).status()).toBe(403);
  await ctx.close();
});
