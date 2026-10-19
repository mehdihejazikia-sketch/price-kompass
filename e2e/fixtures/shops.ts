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

export const emallsSearch = () =>
  page(`<ul class="list">
    <li><a href="/مشخصات_مانیتور-ال-جی~id~777" title="مانیتور ال جی 24MK430H">مانیتور ال جی 24MK430H</a><span>۵٬۱۰۰٬۰۰۰ تومان</span><span>در ۳ فروشگاه</span></li>
    <li><a href="/مشخصات_مانیتور-جی-پلاس~id~555" title="مانیتور جی پلاس مدل GDM-248CS">مانیتور جی پلاس مدل GDM-248CS</a><span>۴٬۶۲۰٬۰۰۰ تومان</span><span>در ۵ فروشگاه</span></li>
  </ul>`);

export const captcha = () => page(`<h1>لطفاً تأیید کنید که ربات نیستید</h1><div class="captcha">CAPTCHA</div>`);
