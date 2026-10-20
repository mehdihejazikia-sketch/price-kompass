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

// hooshmandco.com: an OpenCart shop. The search box has no <form> (OpenCart's own
// script builds index.php?route=product/search&search=…); product pages are /<slug>.
export const hooshmandHome = () =>
  page(`<div id="search"><input type="text" name="search" placeholder="جستجو"><button type="button">🔍</button></div>
    <a href="/index.php?route=account/login">ورود</a><img src="/image/cache/catalog/logo.png" alt="">`,
    `<link href="/catalog/view/theme/default/stylesheet/stylesheet.css" rel="stylesheet">`);

export const hooshmandResults = () =>
  page(`<div class="row">
    <div class="product-layout"><div class="product-thumb"><div class="image"><a href="https://www.hooshmandco.com/gplus-gdm-278ln"><img alt="مانیتور جی پلاس GDM-278LN"></a></div>
      <div class="caption"><h4><a href="https://www.hooshmandco.com/gplus-gdm-278ln">مانیتور جی پلاس GDM-278LN</a></h4><p class="price">۷٬۱۰۰٬۰۰۰ تومان</p></div></div></div>
    <div class="product-layout"><div class="product-thumb"><div class="image"><a href="https://www.hooshmandco.com/gplus-gdm-248cs"><img alt="مانیتور جی پلاس GDM-248CS"></a></div>
      <div class="caption"><h4><a href="https://www.hooshmandco.com/gplus-gdm-248cs">مانیتور 24 اینچ جی پلاس مدل GDM-248CS</a></h4>
      <p class="price"><span class="price-new">۴٬۵۵۰٬۰۰۰ تومان</span> <span class="price-old">۴٬۹۰۰٬۰۰۰ تومان</span></p></div></div></div>
  </div>`, `<link href="/catalog/view/theme/default/stylesheet/stylesheet.css" rel="stylesheet">`);

export const hooshmandProduct = () =>
  page(`<div id="product-product"><div class="row"><div class="col-sm-8"><img alt=""></div>
    <div class="col-sm-4"><h1>مانیتور 24 اینچ جی پلاس مدل GDM-248CS</h1>
      <ul class="list-unstyled"><li>وضعیت: موجود</li></ul>
      <ul class="list-unstyled"><li><h2>۴٬۵۰۰٬۰۰۰ تومان</h2></li></ul></div></div>
    <h3>محصولات مرتبط</h3><div class="product-thumb"><div class="caption"><h4><a href="/cable">کابل HDMI</a></h4><p class="price">۲۵۰٬۰۰۰ تومان</p></div></div></div>`);
