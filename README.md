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
   - `ADMIN_PASSWORD`: a strong password (8+ characters). On **every** deploy this account is
     created or updated (password, admin role, unlocked); the build log shows
     `[hooshmand] synced user <name>`. These variables are the source of truth: a password
     changed in the app is reset to `ADMIN_PASSWORD` on the next deploy.
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

## Product import (accounting export)
- Upload the accounting file as-is (`.xlsx`, `.xls`, `.csv`) on «ورود از اکسل». The header row is
  found automatically (first row with «نام کالا» and «کد کالا»); the saved default format means
  no column mapping step. Unknown headers → manual mapping, optionally saved as the new default.
- Cells are read as text: codes keep leading zeros and full length (EAN up to 21 digits).
- Identity on re-upload: unique code → same product (renames keep price history and pinned
  links); shared code → code + normalized name; no code → normalized name.
  Products with no code are tagged «بدون کد», shared codes «کد تکراری» (filters on «کالاها»).
- The preview shows new / name changed / unchanged / missing / problems before saving.
  Missing products become «غیرفعال» (hidden from search, history kept) unless «حذف» is chosen.
- Every import is logged; the latest one can be undone.
- «دانلود اکسل» writes the same layout (plus model, search term, last prices) and can be re-uploaded.
- The real accounting file for tests goes in `samples/products.xlsx` (git-ignored, never committed).

## Live prices: the browser extension
- Install page on the site: «افزونه» (download zip → Load unpacked in `edge://extensions` or
  `chrome://extensions`, Developer mode on). The zip is built on every deploy with the site's own
  domain allowed (`externally_connectable`); for a custom domain set `EXTENSION_ALLOWED_ORIGINS`.
- Opening a product checks Torob, Digikala and eMalls one after another in background tabs, saves
  every result to the price history and shows the last known prices instantly meanwhile.
- «این کالای درست است» pins that product page, so later checks open it directly.
- One parser per site in `extension/parsers/`; see `extension/README.md` when a site changes.
- Other price sources (official partner APIs, a search API) plug in via
  `src/lib/server/sources/index.ts` without UI changes.

## Install as a desktop app
In Edge or Chrome, «نصب برنامه» in the header (or the install icon in the address bar) installs
قیمت‌یاب as a Windows app with its own window and Start-menu entry. It always loads the latest
deploy; nothing private is cached offline.

## Data safety rules
- Schema changes only via a **new** file in `migrations/` (never edit an applied one).
- Products are soft-deleted (`deleted_at`), price history is append-only.
- No public pages except `/login` (plus manifest/icons/service worker needed for install).
