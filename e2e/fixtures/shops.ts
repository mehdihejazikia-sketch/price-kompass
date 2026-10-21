// Stand-ins for the shop pages, shaped like the real sites' structured data
// (Torob: __NEXT_DATA__ search results; Digikala: its JSON search API, prices
// in Rial; eMalls: item links with Toman prices; product pages with JSON-LD).
// The real sites are unreachable from the test environment.

const page = (body: string, head = "") => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>shop</title>${head}</head><body>${body}</body></html>`;

export const torobSearch = (q: string) =>
  page(
    `<div id="__next"><h1>نتایج جستجو برای ${q}</h1></div>`,
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          searchResult: {
            results: [
              { random_key: "zzz-999", name1: "مانیتور جی پلاس مدل GDM-278LN سایز 27 اینچ", price: 7200000, price_text: "۷٬۲۰۰٬۰۰۰ تومان", shop_text: "در ۴ فروشگاه", web_client_absolute_url: "/p/zzz-999/gplus-278/", stock_status: "" },
              { random_key: "abc-123", name1: "مانیتور جی پلاس مدل GDM-248CS سایز 24 اینچ", name2: "G Plus GDM-248CS", price: 4590000, price_text: "۴٬۵۹۰٬۰۰۰ تومان", shop_text: "در ۱۲ فروشگاه", web_client_absolute_url: "/p/abc-123/gplus-248cs/", stock_status: "" },
            ],
          },
        },
      },
    })}</script>`,
  );

export const torobProduct = () =>
  page(
    `<h1>مانیتور جی پلاس مدل GDM-248CS سایز 24 اینچ</h1><div>از ۴٬۴۹۰٬۰۰۰ تومان</div>`,
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          baseProduct: {
            name1: "مانیتور جی پلاس مدل GDM-248CS سایز 24 اینچ",
            min_price: 4490000,
            products_info: {
              result: [
                { shop_name: "فروشگاه الف", price: 4490000, availability: true },
                { shop_name: "فروشگاه ب", price: 4600000, availability: true },
                { shop_name: "فروشگاه ج", price: 0, availability: false },
              ],
            },
          },
        },
      },
    })}</script>`,
  );

export const digikalaShell = () => page(`<div id="__next">در حال بارگذاری…</div>`);

export const digikalaSearchApi = {
  status: 200,
  data: {
    products: [
      {
        id: 1234567,
        title_fa: "مانیتور جی پلاس مدل GDM-248CS سایز 24 اینچ",
        status: "marketable",
        url: { uri: "/product/dkp-1234567/مانیتور-جی-پلاس/" },
        default_variant: { price: { selling_price: 47500000, rrp_price: 49000000 }, seller: { title: "دیجی‌کالا" } },
      },
    ],
  },
};

// eMalls results: image link + title link per item, price in a separate box
// (not inside any link), "تومان" on its own line.
export const emallsSearch = () =>
  page(`<div class="grid">
    <div class="card"><div class="img"><a href="/مشخصات_مانیتور-ال-جی~id~777"><img alt="مانیتور ال جی 24MK430H"></a></div>
      <div class="body"><h3><a href="/مشخصات_مانیتور-ال-جی~id~777">مانیتور ال جی 24MK430H</a></h3>
      <div class="foot"><div class="shops">در ۳ فروشگاه</div><div class="price"><span>۵٬۱۰۰٬۰۰۰</span><br><span>تومان</span></div></div></div></div>
    <div class="card"><div class="img"><a href="/مشخصات_مانیتور-جی-پلاس~id~555"><img alt="مانیتور جی پلاس GDM-248CS"></a></div>
      <div class="body"><h3><a href="/مشخصات_مانیتور-جی-پلاس~id~555" title="مانیتور جی پلاس مدل GDM-248CS">مانیتور جی پلاس مدل GDM-248CS</a></h3>
      <div class="foot"><div class="shops">در ۵ فروشگاه</div><div class="price"><span>۴٬۶۲۰٬۰۰۰</span><br><span>تومان</span></div></div></div></div>
  </div>`);

export const captcha = () => page(`<h1>لطفاً تأیید کنید که ربات نیستید</h1><div class="captcha">CAPTCHA</div>`);

// eMalls home page with its search box (a GET form, like a real search box)
export const emallsHome = () =>
  page(`<header><form action="/search" method="get"><input type="search" name="q" placeholder="جستجو در ایمالز"><button>جستجو</button></form></header><main>پیشنهادهای امروز</main>`);

export const emalls404 = () => page(`<h1>خطای ۴۰۴</h1><p>صفحه مورد نظر پیدا نشد :(</p>`);

// hooshmandco.com (Portal site builder) as it behaves: no results page; clicking the
// header search box opens an overlay with the real input; typing shows a list of
// products (title + «مشاهده محصول») that are NOT links (they react to a click), and
// the same product is already linked on the home page. Unknown addresses show
// «پیدا نشد! آدرس مورد نظر شما معتبر نیست». Product pages are /<slug>; the price sits in
// a buy box next to «افزودن به سبد خرید», cheaper related products below.
export const hooshmandHome = () =>
  page(`<header><input class="fake" placeholder="جستجو" readonly></header>
  <div class="overlay" hidden><input class="real" type="text" placeholder="جستجو در محصولات"><div class="list"></div></div>
  <main><h2>جدیدترین محصولات</h2>
    <a class="card" href="/gplus-gdm-248cs">جدید مانیتور • GPLUS مانیتور 24 اینچ جی پلاس مدل GDM-248CS ۴۸٬۰۰۰٬۰۰۰ تومان</a></main>
  <script>
    const PRODUCTS = [
      { slug: "gplus-gdm-278ln", title: "مانیتور جی پلاس مدل GDM-278LN" },
      { slug: "gplus-gdm-248cs", title: "مانیتور 24 اینچ جی پلاس مدل GDM-248CS" },
    ];
    const overlay = document.querySelector(".overlay"), real = document.querySelector(".real"), list = document.querySelector(".list");
    document.querySelector(".fake").addEventListener("click", () => { overlay.hidden = false; real.focus(); });
    real.addEventListener("input", () => {
      const q = real.value.trim().toLowerCase();
      setTimeout(() => {
        // like the real shop: every word must be in the title (the Persian full name finds nothing)
        const hits = PRODUCTS.filter((p) => q.split(/\s+/).every((w) => p.title.toLowerCase().includes(w)));
        list.innerHTML = '<div class="row search">جستجوی "' + q + '"</div>' +
          hits.map((p) => '<div class="row item" data-slug="' + p.slug + '"><img alt=""><div><div>' + p.title + '</div><span>مشاهده محصول</span></div></div>').join("");
        list.querySelectorAll(".item").forEach((el) => el.addEventListener("click", () => { location.href = "/" + el.dataset.slug; }));
      }, 400);
    });
  </script>`);

export const hooshmandProduct = () =>
  page(`<nav><a href="/">خانه</a> › <a href="/cat/monitor">مانیتور</a></nav>
  <main>
    <div class="row">
      <div class="gallery"><img alt=""></div>
      <div class="info"><h1>مانیتور 24 اینچ جی پلاس مدل GDM-248CS</h1><div>GPLUS GDM-248CS</div><div>وزن ۹۸۰ گرم</div></div>
      <aside class="buy"><div>خرید آسان</div><div><span>۱۸%</span> <s>۴٬۹۰۰٬۰۰۰</s> <b>۴٬۵۰۰٬۰۰۰</b> تومان</div><button>افزودن به سبد خرید</button></aside>
    </div>
    <section><h3>محصولات مرتبط</h3><a href="/cable">کابل HDMI <span>۲۵۰٬۰۰۰ تومان</span></a></section>
  </main>`);

export const hooshmandNotFound = () => page(`<div>پیدا نشد! آدرس مورد نظر شما معتبر نیست <a href="/">بازگشت</a></div>`);

// OpenCart search with no hits (OpenCart needs every word of the search in the name)
export const hooshmandNoResults = () =>
  page(`<h1>جستجو</h1><p>هیچ محصولی مطابق با معیارهای جستجو وجود ندارد.</p>`, `<link href="/catalog/view/theme/default/stylesheet/stylesheet.css" rel="stylesheet">`);

// eMalls as seen on a real PC: search at /لیست-قیمت~skey~<term>; the result cards
// show no price that can be read, the product page (…~id~N) has it (JSON-LD).
export const emallsSkeyResults = () =>
  page(`<div class="grid">
    <div class="card"><a href="/مشخصات_LG-24MK430H~id~777"><img alt=""></a><h3><a href="/مشخصات_LG-24MK430H~id~777">مانیتور ال جی 24MK430H</a></h3><div class="p">قیمت: <span>استعلام</span></div></div>
    <div class="card"><a href="/مشخصات_Gplus-GDM-248CS~id~555"><img alt=""></a><h3><a href="/مشخصات_Gplus-GDM-248CS~id~555">مانیتور جی پلاس مدل GDM-248CS</a></h3><div class="p">قیمت: <span>استعلام</span></div></div>
  </div>`);

// product page: JSON-LD without a price; the shop list shows bare numbers, the unit only in the header
export const emallsProduct = () =>
  page(`<h1>مانیتور جی پلاس مدل GDM-248CS</h1><div>مقایسه قیمت در ۵ فروشگاه</div>
    <table class="shops"><thead><tr><th>فروشگاه</th><th>قیمت (تومان)</th></tr></thead>
    <tbody><tr><td>فروشگاه الف</td><td class="shop-price">۴٫۸۰۰٫۰۰۰</td></tr>
           <tr><td>فروشگاه ب</td><td class="shop-price">۴٫۶۲۰٫۰۰۰</td></tr>
           <tr><td>فروشگاه ج</td><td class="shop-price"><del>۵٫۲۰۰٫۰۰۰</del></td></tr></tbody></table>`,
    `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: "مانیتور جی پلاس مدل GDM-248CS", brand: "GPlus" })}</script>`);
