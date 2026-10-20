import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import * as XLSX from "@e965/xlsx";
import { loginAs } from "./helpers";

function accountingFile(rows: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet([["", "", ""], ["نام کالا", "کد کالا", "رديف"], ...rows, ["", "", ""]]);
  ws["!merges"] = [XLSX.utils.decode_range("A1:C1")];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Page1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test.describe.configure({ mode: "serial" });

test("one-click import of the accounting format, search with keyboard, export + re-import", async ({ page }) => {
  await loginAs(page);
  await page.goto("/import");
  const real = existsSync("samples/products.xlsx");
  const buffer = real
    ? readFileSync("samples/products.xlsx")
    : accountingFile([
        ["مانیتور 24 اینچ جی پلاس مدل GDM-248CS", "88724", "1"],
        ["آداپتور دوربيني 12V/2A", "3120013", "2"],
        ["اداپتور 14v/3Ah اصلي", "3120013", "3"],
        ["كيف دستي", "", "4"],
      ]);
  if (real) {
    // the test product is not in the accounting file; add it so stage-c tests can use it
  }
  await page.getByTestId("file-input").setInputFiles({ name: "products.xlsx", mimeType: XLSX_MIME, buffer });
  // no mapping step: straight to the preview
  await expect(page.getByTestId("import-preview")).toBeVisible();
  if (real) {
    await expect(page.getByTestId("count-new")).toContainText("۴٬۵۲۵");
    await expect(page.getByTestId("count-dup_code")).toContainText("۶ کد");
    await expect(page.getByTestId("count-no_code")).toContainText("۲٬۲۹۶");
  } else {
    await expect(page.getByTestId("count-new")).toContainText("۴");
  }
  await page.getByTestId("count-dup_code").click();
  await expect(page.getByText("کد تکراری").first()).toBeVisible();
  await page.getByRole("button", { name: "ثبت در فهرست کالاها" }).click();
  await expect(page.getByTestId("import-result")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("سابقه ورود اکسل")).toBeVisible();

  // the test product by hand
  if (real) {
    await page.goto("/products/new");
    await page.getByLabel(/^نام کالا/).fill("مانیتور 24 اینچ جی پلاس مدل GDM-248CS");
    await page.getByLabel("کد کالا", { exact: true }).fill("88724");
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page.getByRole("heading", { name: /GDM-248CS/ })).toBeVisible();
  }

  // search: Persian digits for the code, Enter opens the product
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "جستجوی کالا" });
  await expect(box).toBeFocused();
  await box.fill("۸۸۷۲۴");
  await expect(page.getByRole("option").first()).toContainText("GDM-248CS");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/products\/\d+$/);
  await expect(page.getByText("GDM-248CS").first()).toBeVisible();

  // fuzzy: Arabic ي/ك and arrow keys
  await page.goto("/");
  await box.fill("كيف");
  await expect(page.getByRole("option").first()).toBeVisible();
  await box.press("ArrowDown");
  await box.press("ArrowUp");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/products\/\d+$/);

  // export in the same format, then re-import it: nothing changes
  await page.goto("/products");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "دانلود اکسل" }).click()]);
  const path = await download.path();
  const wb = XLSX.read(readFileSync(path!), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  expect(rows[1].slice(0, 8)).toEqual(["سطح 2", "", "سطح 1", "نام كالا", "كد كالا", "رديف", "مدل", "عبارت جستجو"]);
  expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);

  await page.goto("/import");
  await page.getByTestId("file-input").setInputFiles({ name: "export.xlsx", mimeType: XLSX_MIME, buffer: readFileSync(path!) });
  await expect(page.getByTestId("import-preview")).toBeVisible();
  await expect(page.getByTestId("count-new")).toContainText("۰");
  await expect(page.getByTestId("count-missing")).toContainText("۰");
  await expect(page.getByTestId("count-name_changed")).toContainText("۰");
});

test("manual mapping fallback when headers are unknown", async ({ page }) => {
  await loginAs(page);
  await page.goto("/import");
  const ws = XLSX.utils.aoa_to_sheet([["Product title", "SKU"], ["کالای تست", "12345"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "S");
  await page.getByTestId("file-input").setInputFiles({ name: "x.xlsx", mimeType: XLSX_MIME, buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) });
  await expect(page.getByText("ستون‌ها را دستی مشخص کنید")).toBeVisible();
  await page.getByLabel("نام کالا", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("کد کالا", { exact: true }).selectOption({ index: 2 });
  await page.getByLabel("این ستون‌ها قالب پیش‌فرض شوند").uncheck();
  await page.getByRole("button", { name: "ادامه به پیش‌نمایش" }).click();
  await expect(page.getByTestId("count-new")).toContainText("۱");
});
