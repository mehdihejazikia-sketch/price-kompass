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

// hooshmandco.com: a WordPress/WooCommerce shop (home page, then ?s=…&post_type=product)
export const hooshmandHome = () =>
  page(`<header><form role="search" action="/"><input type="search" name="s" placeholder="جستجوی محصولات"></form></header>`, `<link rel="stylesheet" href="/wp-content/themes/shop/style.css">`);

export const hooshmandResults = () =>
  page(`<ul class="products">
    <li class="product type-product instock"><a href="https://www.hooshmandco.com/product/gplus-gdm-278ln/" class="woocommerce-LoopProduct-link"><h2 class="woocommerce-loop-product__title">مانیتور جی پلاس GDM-278LN</h2>
      <span class="price"><span class="woocommerce-Price-amount amount"><bdi>۷٬۱۰۰٬۰۰۰&nbsp;<span class="woocommerce-Price-currencySymbol">تومان</span></bdi></span></span></a></li>
    <li class="product type-product instock"><a href="https://www.hooshmandco.com/product/gplus-gdm-248cs/" class="woocommerce-LoopProduct-link"><h2 class="woocommerce-loop-product__title">مانیتور 24 اینچ جی پلاس مدل GDM-248CS</h2>
      <span class="price"><del><span class="woocommerce-Price-amount amount"><bdi>۴٬۹۰۰٬۰۰۰&nbsp;<span class="woocommerce-Price-currencySymbol">تومان</span></bdi></span></del>
      <ins><span class="woocommerce-Price-amount amount"><bdi>۴٬۵۵۰٬۰۰۰&nbsp;<span class="woocommerce-Price-currencySymbol">تومان</span></bdi></span></ins></span></a></li>
  </ul>`, `<link rel="stylesheet" href="/wp-content/plugins/woocommerce/style.css">`);
