// Decides which search result is really our product. Shared by the extension
// (background.js) and the website (src/lib/match.ts imports this file), so the
// website can re-check results without a new extension version.
//
// A result must agree on the product TYPE (موس / ماوس / mouse…) and the BRAND
// (LOGITECH / لاجیتک…), not only on the model code: "M-90" alone also matches
// "ایرپاد بلوتوثی مدل M90 PRO".

const DIG = "۰۱۲۳۴۵۶۷۸۹";
const ADIG = "٠١٢٣٤٥٦٧٨٩";

export function norm(s) {
  return String(s ?? "")
    .replace(/[۰-۹]/g, (d) => String(DIG.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ADIG.indexOf(d)))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[​-‏﻿]/g, "")
    // words stuck together in accounting names: «لنووlenovo» → «لنوو lenovo», «شارژرنوت» → «شارژر نوت»
    .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1 $2")
    .replace(/(شارژر|آداپتور|اداپتور|کیبورد|کیبرد|ماوس|موس|کابل|کیف|باتری|باطری)(?=[\u0600-\u06FF]{2,})/g, "$1 ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export const compact = (s) => norm(s).replace(/\s+/g, "");

// product types: any word of a group counts as the same type
const TYPES = [
  ["موس", "ماوس", "mouse"],
  ["کیبورد", "کیبرد", "صفحه کلید", "keyboard"],
  ["کیبورد موس", "کیبرد موس", "ست کیبورد", "keyboard mouse", "combo"],
  ["هدفون", "هدست", "headphone", "headset", "ایرفون", "هندزفری", "ایرپاد", "earphone", "earbuds"],
  ["اسپیکر", "بلندگو", "speaker"],
  ["مانیتور", "مونیتور", "نمایشگر", "monitor"],
  ["حافظه رم", "رم", "ram", "memory"],
  ["حافظه", "رم", "ram", "memory", "مموری", "فلش", "حافظه جانبی"],
  ["هاب", "hub", "هاب usb"],
  ["میکروفون", "microphone", "mic"],
  ["تبلت", "tablet"],
  ["اسکنر", "scanner", "بارکد خوان", "بارکدخوان"],
  ["دانگل", "dongle"],
  ["پروژکتور", "ویدئو پروژکتور", "ویدیو پروژکتور", "projector"],
  ["کارت شبکه", "network card"],
  ["پرزنتر", "presenter"],
  ["استابلایزر", "ترانس", "stabilizer"],
  ["کاور", "قاب", "cover", "case"],
  ["فلش", "flash", "usb drive"],
  ["هارد", "hdd", "ssd", "hard"],
  ["آداپتور", "اداپتور", "شارژر", "adapter", "adaptor", "charger"],
  ["باتری", "باطری", "battery"],
  ["کابل", "cable"],
  ["تبدیل", "مبدل", "converter"],
  ["فن", "fan", "خنک کننده", "cooler"],
  ["نوت بوک", "لپ تاپ", "لپتاپ", "laptop", "notebook"],
  ["کیف", "کوله", "bag", "backpack"],
  ["دوربین", "camera"],
  ["پرینتر", "چاپگر", "printer"],
  ["کارتریج", "تونر", "toner", "cartridge"],
  ["درام", "drum"],
  ["پاوربانک", "پاور بانک", "powerbank", "power bank"],
  ["روتر", "مودم", "router", "modem"],
  ["سوئیچ", "سوییچ", "switch"],
  ["پاور", "منبع تغذیه", "power supply", "psu"],
  ["کیس", "case"],
  ["مادربرد", "مادربورد", "motherboard", "mainboard"],
  ["پردازنده", "cpu", "processor"],
  ["کارت گرافیک", "گرافیک", "vga", "gpu"],
  ["رک", "rack"],
  ["یو پی اس", "یوپی اس", "ups"],
  ["وب کم", "وبکم", "webcam"],
  ["پد", "ماوس پد", "mousepad", "pad"],
];
// where the name's first word is one of these, it is the product type
const TYPE_WORDS = new Map();
for (const group of TYPES) for (const w of group) TYPE_WORDS.set(norm(w), group.map(norm));

const BRANDS = {
  logitech: ["لاجیتک", "لاجیتیک"], asus: ["ایسوس"], samsung: ["سامسونگ"], lenovo: ["لنوو"], hp: ["اچ پی"],
  tsco: ["تسکو"], genius: ["جنیوس"], gplus: ["جی پلاس"], "g plus": ["جی پلاس"], xiaomi: ["شیائومی", "شیامی"],
  apple: ["اپل"], sony: ["سونی"], lg: ["ال جی"], kingston: ["کینگستون"], adata: ["ای دیتا"], gskill: ["جی اسکیل"],
  microsoft: ["مایکروسافت"], a4tech: ["ای فورتک", "a4 tech"], dell: ["دل"], acer: ["ایسر"], msi: ["ام اس آی"],
  canon: ["کانن"], epson: ["اپسون"], sharp: ["شارپ"], "tp link": ["تی پی لینک"], tplink: ["تی پی لینک"],
  "d link": ["دی لینک"], dlink: ["دی لینک"], gamemax: ["گیم مکس"], green: ["گرین"], farassoo: ["فراسو"],
  verity: ["وریتی"], beyond: ["بیاند"], hatron: ["هترون"], sandisk: ["سن دیسک"], transcend: ["ترنسند"],
  toshiba: ["توشیبا"], seagate: ["سیگیت"], wd: ["وسترن دیجیتال"], kstar: ["کی استار"], hikvision: ["هایک ویژن"],
  dahua: ["داهوا"], panasonic: ["پاناسونیک"], philips: ["فیلیپس"], anker: ["انکر"], baseus: ["باسئوس"],
  huawei: ["هوآوی", "هواوی"], honor: ["آنر"], razer: ["ریزر"], corsair: ["کورسیر"], intel: ["اینتل"],
  amd: ["ای ام دی"], nvidia: ["انویدیا"], gigabyte: ["گیگابایت"], micronics: ["مایکرونیکس"],
  awest: ["ای وست", "اوست"], foxray: ["فاکس ری"], kingstar: ["کینگ استار"], cisco: ["سیسکو"], mitsushida: ["میتسوشیدا"],
  brother: ["برادر"], crucial: ["کروشیال"], apacer: ["اپیسر", "اپیسر"], lexar: ["لکسار"], kisonli: ["کیسونلی"],
  kingmax: ["کینگ مکس"], zotac: ["زوتک"], legrand: ["لگراند"], lexmark: ["لکسمارک"], earldom: ["ارلدام"], geil: ["گیل"],
  patriot: ["پاتریوت"], ugreen: ["یوگرین"], mikrotik: ["میکروتیک"], sp: ["سیلیکون پاور", "silicon power"], meva: ["میوا"],
  unicom: ["یونیکام"], enzo: ["انزو"], titan: ["تایتان"], royal: ["رویال"], ergo: ["ارگو"], proone: ["پرووان"],
};
// Latin words that are not brands
const NOT_BRAND = new Set(["usb", "type", "c", "led", "rgb", "to", "ide", "sata", "hdmi", "vga", "dvi", "port", "pro", "max", "plus", "mini",
  "ultra", "lite", "air", "wireless", "bluetooth", "gaming", "intel", "ddr", "d4", "d5", "ram", "ssd", "hdd", "inch", "w", "v", "a", "ah", "mah",
  "gb", "tb", "g", "kvm", "cat", "used", "display", "net", "sftp", "utp", "ftp", "aio", "giga", "ef", "lq", "xp", "ups", "hub", "dc", "ac", "oem", "box", "original", "orginal", "copy", "cm", "mm", "pin", "watt", "wifi", "lan", "poe", "nvme", "m2", "pcie", "fhd", "hd", "ips", "the", "and", "with", "for"]);
// edition words that make a different product when only the result has them
const EDITIONS = ["pro", "max", "plus", "ultra", "mini", "lite", "air", "se", "neo", "prime"];
const STOP = new Set(["مدل", "اصلی", "با", "و", "برای", "سایز", "اینچ", "عدد", "جدید", "طرح", "رنگ", "نسخه", "سری", "ظرفیت"]);

function has(titleNorm, titleCompact, word) {
  const w = norm(word);
  if (!w) return false;
  return w.includes(" ") ? titleCompact.includes(w.replace(/\s+/g, "")) : ` ${titleNorm} `.includes(` ${w} `) || (w.length >= 4 && titleCompact.includes(w));
}

/** What we know about our product, from its name / model / brand. */
export function productSignals(product) {
  const name = norm(product.name || product.search_term);
  const words = name.split(" ").filter(Boolean);
  // product type: the first Persian word(s), or a known type word anywhere
  let type = null;
  // earliest position wins («کیف کوله نوت بوک» is a bag, not a laptop); longer phrase first
  for (let i = 0; i < Math.min(words.length, 4) && !type; i++) {
    for (let n = 2; n >= 1 && !type; n--) {
      if (i + n > words.length) continue;
      const key = words.slice(i, i + n).join(" ");
      if (TYPE_WORDS.has(key)) type = TYPE_WORDS.get(key);
    }
  }
  const firstFa = words.find((w) => /[؀-ۿ]/.test(w) && !STOP.has(w));
  if (!type && firstFa && firstFa.length >= 2) type = [firstFa];
  const model = compact(product.model);
  const brands = [];
  const brandText = norm(product.brand);
  for (const [b, fa] of Object.entries(BRANDS)) {
    if (` ${name} `.includes(` ${b} `) || (brandText && ` ${brandText} `.includes(` ${b} `)) || fa.some((f) => ` ${name} `.includes(` ${norm(f)} `))) {
      brands.push([b, ...fa]);
    }
  }
  if (!brands.length) {
    // an unknown Latin word that is not the model or a spec: probably the brand
    const latin = words.filter((w) => /^[a-z][a-z]+$/.test(w) && !NOT_BRAND.has(w) && compact(w) !== model);
    if (latin[0]) {
      const guess = [latin[0]];
      guess.guessed = true; // not in the dictionary: the shop may spell it in Persian
      brands.push(guess);
    }
  }
  const editions = EDITIONS.filter((e) => ` ${name} `.includes(` ${e} `));
  const tokens = words.filter((w) => w.length >= 2 && !STOP.has(w));
  return { type, model, brands, editions, tokens };
}

/** Score a shop result against our product. ≥ 80 sure, ≥ 45 probably, else wrong product. */
export function score(candidate, product, signals = productSignals(product)) {
  const tn = norm(candidate.title);
  const tc = tn.replace(/\s+/g, "");
  let s = 0;
  const reasons = [];
  if (signals.model && signals.model.length >= 3) {
    if (tc.includes(signals.model)) s += 50;
    else {
      // a spec-like "model" (lenovo20v/3.25A): all its numbers in the title count almost as much
      const nums = signals.model.match(/\d+/g) ?? [];
      if (nums.length >= 2 && nums.every((n) => tc.includes(n))) s += 35;
      else { s -= 15; reasons.push("model"); }
    }
  }
  if (signals.type) {
    if (signals.type.some((w) => has(tn, tc, w))) s += 30;
    else { s -= 40; reasons.push("type"); }
  }
  if (signals.brands.length) {
    if (signals.brands.some((group) => group.some((w) => has(tn, tc, w)))) s += 20;
    else { s -= signals.brands.every((g) => g.guessed) ? 8 : 20; reasons.push("brand"); }
  }
  const extra = EDITIONS.filter((e) => ` ${tn} `.includes(` ${e} `) && !signals.editions.includes(e));
  if (extra.length) { s -= Math.min(30, 15 * extra.length); reasons.push("edition"); }
  if (signals.tokens.length) s += Math.round((10 * signals.tokens.filter((t) => has(tn, tc, t)).length) / signals.tokens.length);
  if (candidate.price) s += 2;
  return { score: s, reasons };
}

export function matchLevel(s, signals) {
  const hasModel = signals.model && signals.model.length >= 3;
  if (s >= (hasModel ? 80 : 55)) return "exact";
  if (s >= (hasModel ? 45 : 35)) return "partial";
  return "weak";
}

/** Best result + how sure we are ("exact" | "partial" | "weak"). */
export function pickBest(candidates, product) {
  const signals = productSignals(product);
  const scored = (candidates || [])
    .filter((c) => c && c.title)
    .map((c, i) => ({ c, i, ...score(c, product, signals) }))
    .sort((a, b) => b.score - a.score || (b.c.price ? 1 : 0) - (a.c.price ? 1 : 0) || a.i - b.i);
  if (!scored.length) return null;
  const top = scored[0];
  return { ...top.c, match: matchLevel(top.score, signals), score: top.score, reasons: top.reasons };
}
