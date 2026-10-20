# Price Kompass (قیمت‌یاب): notes for Claude Code sessions

- Repo `mehdihejazikia-sketch/price-kompass`, branch `main`; every push deploys on Vercel.
- Before changing anything: `git pull origin main`. After a change: `npm run typecheck`,
  `npm test`, `npm run build`, `npm run test:e2e` (local Postgres: `service postgresql start`,
  user/password `pk`/`pk`, databases `pk` and `pk_test`), then commit and push to `main`.
- UI text is Farsi, RTL. Prices are stored in **Toman** (`price_toman`); Rial ÷ 10.
- Schema changes: add `migrations/NNN_name.sql`. Never edit applied migrations, never
  DROP/TRUNCATE (the migrate script refuses). Products: soft delete only.
- Shop sites (torob, digikala, emalls) are blocked from the cloud environment and block
  servers in general. The server never fetches them; prices are read by the extension
  (`/extension`, one parser file per site in `extension/parsers/`).

## Status (Oct 2026)
- Stages a–d built: login/users, accounting-format Excel import (preview diff, log, undo, export),
  search, extension + live check + pinning, price history page + chart, PWA.
- The extension parsers were developed from public scrapers' knowledge of the sites and tested
  only against mock pages (`e2e/fixtures/`); real sites can't be reached from the cloud environment.
  If a site fails on a real PC, fix `extension/parsers/<site>.js` and bump the manifest version.
- e2e tests bind port 443 for the mock shop server (`e2e/fixtures/shop-server.ts`), so they run as root.
- Matching (Oct 2026): `extension/match.js` is shared by the extension and the website
  (`src/lib/match.ts`, `src/lib/sources/evaluate.ts`). A result must agree on product type,
  brand and model; wrong products become «پیدا نشد» with a suggestion. Only exact/pinned
  results count as the price (`CONFIRMED` in `src/lib/server/prices.ts`). Search term default =
  cleaned product name (migration 003). Extension 1.1.0 sends all candidates to the website.
- eMalls (Oct 2026): the guessed search address 404s. Extension 1.2.0 opens https://emalls.ir/,
  types into eMalls' own search box, and remembers the results address as a template in
  `chrome.storage.local` (`emallsSearch`); a 404 clears it. The website's fallback button opens
  the eMalls home page until the real search address format is known.
- Own prices (Oct 2026): the accounting «تابلوي قيمت کالاها» export has «سطح 2», «سطح 1» (Rial),
  «نام كالا», «كد كالا», «رديف» and a footer date "[today DD/MM/YYYY]". Stored in Toman as
  `products.price_level1/2` (migration 004), history in `system_prices`. The columns of each
  successful import are saved as the company's import format (incl. `price_unit`). Product page:
  «قیمت‌های سیستم» box above «قیمت در سایت‌ها» (with a «نسبت به سطح ۱» column). Export uses the
  same layout. Real file for tests: `samples/products-prices.xlsx` (git-ignored).
- Fourth site (Oct 2026): hooshmandco.com («هوشمند», site id `hooshmand`, `products.url_hooshmand`,
  migration 005). Its layout was unknown (unreachable from the cloud), so `extension/parsers/hooshmand.js`
  is a general shop parser. Real product pages look like `/rapoo-nk8800-keyboard` (OpenCart): search via
  a search <form>, OpenCart `index.php?route=product/search&search=…`, WordPress `?s=`, or usual
  addresses tried one per attempt (synthetic Enter keys don't trigger OpenCart's search script);
  results: JSON-LD → `.product-thumb`/WooCommerce cards → links with a price; pinned links are always
  read as product pages (price next to the <h1>). Extension 1.3.1. Search address learned like eMalls
  (`searchTpl:hooshmand`). Extension 1.3.0; older extensions get «افزونه را به‌روز کنید» for it.
  Adding another site: `src/lib/sites.ts`, `extension/sites.js` + manifest host permission,
  a parser file, a `url_<site>` column (migration) and the url_* lists in products/importDiff.
