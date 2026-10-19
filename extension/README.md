# قیمت‌یاب browser extension (Manifest V3, Edge + Chrome)

- `background.js`: receives `{type:"check", product, sites}` from the website (externally_connectable
  port), then for each site, one at a time: opens the search page (or the pinned product page) in a
  background tab, injects `parsers/common.js` + `parsers/<site>.js`, runs the parser, closes the tab and
  posts `{type:"result", result}`. `match.js` picks the result whose title contains the model code.
- `parsers/<site>.js`: **one file per site**. When a site changes its layout, only that file needs fixing.
  Each parser tries structured data first (JSON-LD, `__NEXT_DATA__`, the site's own JSON API called
  from inside the page) and falls back to reading product links/prices from the page.
- Prices: Torob and eMalls are Toman; Digikala's JSON is Rial (÷10). `common.js › reconcile()` compares
  structured prices with the prices visible on the page to tell Rial from Toman.
- The website domain allowed to talk to the extension is set in `manifest.json › externally_connectable`;
  the zip offered on the install page (`npm run build` → `.generated/`) adds the Vercel production domain.
- The `key` in the manifest fixes the extension ID (also for "Load unpacked"), the website reads it at build.
- Popup → «آزمایش …» runs one site check and shows the raw result (for diagnosing a broken parser).
- After changing anything here, bump `version` in `manifest.json`: the install page then tells users
  with the old version to update.
