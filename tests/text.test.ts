import { describe, expect, it } from "vitest";
import { compactText, normalizeCode, normalizeName, normalizeText } from "@/lib/normalize";
import { defaultSearchTerm, extractModel } from "@/lib/model";
import { faNum, formatToman, timeAgo, toToman } from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/server/password";

describe("normalize", () => {
  it("folds Arabic letters, half-spaces and digits", () => {
    expect(normalizeText("مانيتور ۲۴ اينچ كامپيوتر")).toBe(normalizeText("مانیتور 24 اینچ کامپیوتر"));
    expect(normalizeText("می‌خواهم")).toBe("می خواهم");
    expect(compactText("می‌خواهم")).toBe(compactText("میخواهم"));
    expect(compactText("GDM-248CS")).toBe("gdm248cs");
    expect(compactText("gdm 248 cs")).toBe("gdm248cs");
  });
  it("normalizes codes", () => {
    expect(normalizeCode("۸۸۷۲۴")).toBe("88724");
    expect(normalizeCode(" 0100248400002\u200c")).toBe("0100248400002");
    expect(normalizeCode("2282610098500074")).toBe("2282610098500074");
    expect(normalizeCode("A-12")).toBe("A-12");
  });
});

describe("normalizeName", () => {
  it("keeps punctuation, folds letters and spaces", () => {
    expect(normalizeName("  باطري سيلداسيد       12V/42 AH ")).toBe("باطری سیلداسید 12v/42 ah");
    expect(normalizeName("كيف\u200bدستي ۱۷")).toBe("کیفدستی 17");
    expect(normalizeName("12V/7.AH")).not.toBe(normalizeName("12V/7AH"));
  });
});

describe("model extraction", () => {
  it("finds the Latin model in a Farsi name", () => {
    expect(extractModel("مانیتور 24 اینچ جی پلاس مدل GDM-248CS")).toBe("GDM-248CS");
    expect(extractModel("مانیتور ۲۴ اینچ سامسونگ LS24C310EAMXUE")).toBe("LS24C310EAMXUE");
    expect(extractModel("گوشی موبایل سامسونگ مدل Galaxy A55 5G SM-A556E/DS")).toBe("A55");
    expect(extractModel("کابل شارژ")).toBe("");
    expect(extractModel("کابل رابط چاپگر 1.5m U.S.B")).toBe("");
    expect(extractModel("پاور بانک ASUS 10000mAh")).toBe("");
  });
  it("search term falls back to the name", () => {
    expect(defaultSearchTerm("  موس   LOGITECH M-90 ")).toBe("موس LOGITECH M-90");
    expect(defaultSearchTerm("كيف دستي")).toBe("کیف دستی");
    expect(defaultSearchTerm("کابل شارژ")).toBe("کابل شارژ");
  });
});

describe("format", () => {
  it("Persian digits and Toman", () => {
    expect(faNum(12500000)).toBe("۱۲٬۵۰۰٬۰۰۰");
    expect(formatToman(4590000)).toBe("۴٬۵۹۰٬۰۰۰ تومان");
    expect(toToman(45900000, "IRR")).toBe(4590000);
    expect(toToman(4590000, "TOMAN")).toBe(4590000);
  });
  it("relative time", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(timeAgo(new Date("2026-10-19T10:00:00Z"), now)).toBe("۲ ساعت پیش");
    expect(timeAgo(new Date("2026-10-19T11:59:50Z"), now)).toBe("همین الان");
  });
});

describe("password", () => {
  it("hashes and verifies", () => {
    const h = hashPassword("secret-123");
    expect(verifyPassword("secret-123", h)).toBe(true);
    expect(verifyPassword("secret-124", h)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});
