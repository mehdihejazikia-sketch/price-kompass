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
