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
