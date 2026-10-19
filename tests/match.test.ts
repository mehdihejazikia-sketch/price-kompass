import { describe, expect, it } from "vitest";
import { pickBest, productSignals } from "@/lib/match";
import { evaluateResult } from "@/lib/sources/evaluate";

const mouse = { name: "موس LOGITECH M-90", model: "M-90" };

describe("matcher: type + brand + model", () => {
  it("knows type and brand of accounting names", () => {
    const s = productSignals(mouse);
    expect(s.type).toContain("ماوس");
    expect(s.brands[0]).toContain("لاجیتک");
    expect(productSignals({ name: "کيف کوله نوت بوک ASUS" }).type).toContain("کیف");
    expect(productSignals({ name: "حافظه RAM 16G D5-5200-GSKILL", model: "D5-5200-GSKILL" }).type).toContain("رم");
  });

  it("rejects headphones for the Logitech M-90 mouse (screenshot case)", () => {
    const best = pickBest([
      { title: "ایرپاد بلوتوثی مدل M90 PRO", price: 965000 },
      { title: "هدفون بلوتوثی مدل M90 Pro بدون قابلیت نویز کنسلینگ", price: 699000 },
    ], mouse)!;
    expect(best.match).toBe("weak");
  });

  it("finds the real mouse, in Persian or English spelling", () => {
    const list = [
      { title: "هدفون بلوتوثی مدل M90 Pro", price: 699000 },
      { title: "ماوس لاجیتک مدل M90", price: 289000 },
      { title: "ماوس بی سیم لاجیتک مدل M185", price: 450000 },
    ];
    const best = pickBest(list, mouse)!;
    expect(best.title).toBe("ماوس لاجیتک مدل M90");
    expect(best.match).toBe("exact");
    expect(pickBest([{ title: "Logitech M90 Mouse", price: 1 }], mouse)!.match).toBe("exact");
  });

  it("GDM-248CS monitor", () => {
    const p = { name: "مانیتور 24 اینچ جی پلاس مدل GDM-248CS", model: "GDM-248CS" };
    const best = pickBest([
      { title: "مانیتور جی پلاس مدل GDM-278LN سایز 27 اینچ", price: 7200000 },
      { title: "مانیتور جی پلاس مدل GDM-248CS سایز 24 اینچ", price: 4590000 },
    ], p)!;
    expect(best.price).toBe(4590000);
    expect(best.match).toBe("exact");
  });

  it("weak results become 'not found' with a suggestion", () => {
    const r = evaluateResult(
      { site: "torob", status: "ok", source: "extension", title: "ایرپاد بلوتوثی مدل M90 PRO", price: 965000, price_toman: 965000, currency: "IRT", match: "partial" },
      { id: 1, ...mouse, search_term: "موس LOGITECH M-90", urls: {} },
    );
    expect(r.status).toBe("not_found");
    expect(r.price_toman).toBeNull();
    expect(r.suggestion?.title).toContain("M90 PRO");
  });

  it("pinned product pages are trusted", () => {
    const r = evaluateResult(
      { site: "torob", status: "ok", source: "extension", title: "anything", price: 5, price_toman: 5, match: "pinned", pinned: true },
      { id: 1, ...mouse, search_term: "", urls: {} },
    );
    expect(r.status).toBe("ok");
  });
});
