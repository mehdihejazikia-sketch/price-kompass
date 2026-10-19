# قیمت‌یاب (Price Kompass)

A private Farsi (RTL) price-lookup site for a sales team. A salesperson types a product
name or internal code and sees the current price on **torob.com**, **digikala.com** and
**emalls.ir**, read live in their own browser by a companion browser extension.

Stack: Next.js 16 + TypeScript, Tailwind CSS 4, Postgres (Neon via Vercel), own
username/password accounts, installable PWA, Manifest V3 extension in `/extension`.

## Deploy to Vercel (one time)

1. **Import the repo**: vercel.com → *Add New… → Project* → import
   `mehdihejazikia-sketch/price-kompass`. Framework: Next.js (detected). Keep the defaults.
2. **Database**: in the Vercel project → *Storage* → *Create Database* → **Neon (Postgres)** →
   connect it to the project (all environments). This sets `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` automatically.
3. **Environment variables** (*Settings → Environment Variables*):
   - `ADMIN_USERNAME`: your admin login, e.g. `mehdi`
   - `ADMIN_PASSWORD`: a strong password (8+ characters). Used only once, to create the
     first admin when the database has no users. Change it later in the app (حساب کاربری).
   - `ADMIN_COMPANY`: company name shown in the footer (optional)
4. **Redeploy** (*Deployments → … → Redeploy*) so the build sees the database and variables.

From then on every push to `main` deploys automatically. Open tabs show a
"نسخه جدید آماده است" bar and pick up the new version on reload.

### What runs on each deploy
`npm run build` = `scripts/migrate.mjs` (applies new files in `migrations/`, once each, inside
a transaction; refuses DROP/TRUNCATE) → `scripts/build-extension.mjs` → `next build`.
Products and price history are never deleted by a deploy.

## Local development

```bash
cp .env.example .env        # point DATABASE_URL at a local Postgres
npm install
npm run migrate             # creates tables + first admin from ADMIN_* variables
npm run dev                 # http://localhost:3000
npm test                    # unit + database tests (vitest)
npm run test:e2e            # browser tests (Playwright, uses database pk_test)
```

## Data safety rules
- Schema changes only via a **new** file in `migrations/` (never edit an applied one).
- Products are soft-deleted (`deleted_at`), price history is append-only.
- No public pages except `/login` (plus manifest/icons/service worker needed for install).
