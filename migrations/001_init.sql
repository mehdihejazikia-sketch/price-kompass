-- Price Kompass initial schema.
-- Rule: migrations are append-only. Never edit an applied file; add a new one.
-- Nothing here drops or truncates data.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS companies (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id              bigserial PRIMARY KEY,
  company_id      bigint NOT NULL REFERENCES companies(id),
  username        text NOT NULL,
  display_name    text NOT NULL DEFAULT '',
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active          boolean NOT NULL DEFAULT true,
  failed_logins   int NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS products (
  id              bigserial PRIMARY KEY,
  company_id      bigint NOT NULL REFERENCES companies(id),
  internal_code   text NOT NULL,
  name            text NOT NULL,
  brand           text NOT NULL DEFAULT '',
  model           text NOT NULL DEFAULT '',
  search_term     text NOT NULL DEFAULT '',
  url_torob       text,
  url_digikala    text,
  url_emalls      text,
  -- normalized text for search (see src/lib/normalize.ts)
  search_norm     text NOT NULL DEFAULT '',
  search_compact  text NOT NULL DEFAULT '',
  -- soft delete only: price history must never lose its product
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, internal_code)
);
CREATE INDEX IF NOT EXISTS products_norm_trgm ON products USING gin (search_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_compact_trgm ON products USING gin (search_compact gin_trgm_ops);

CREATE TABLE IF NOT EXISTS price_checks (
  id            bigserial PRIMARY KEY,
  company_id    bigint NOT NULL REFERENCES companies(id),
  product_id    bigint NOT NULL REFERENCES products(id),
  site          text NOT NULL,
  source        text NOT NULL DEFAULT 'extension',
  status        text NOT NULL CHECK (status IN ('ok', 'not_found', 'error')),
  title         text,
  price_toman   bigint,
  price_raw     bigint,
  currency      text,
  url           text,
  in_stock      boolean,
  seller        text,
  seller_count  int,
  match         text,
  message       text,
  checked_by    bigint REFERENCES users(id),
  checked_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_checks_product_idx ON price_checks (product_id, site, checked_at DESC);
CREATE INDEX IF NOT EXISTS price_checks_company_idx ON price_checks (company_id, checked_at DESC);
