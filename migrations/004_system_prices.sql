-- Our own selling prices from the accounting export («سطح 1», «سطح 2»), in Toman.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_level1 bigint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_level2 bigint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS prices_updated_at timestamptz;

-- the date printed in the file ("[today 20/10/2026]"), shown as "prices as of"
ALTER TABLE imports ADD COLUMN IF NOT EXISTS file_date date;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS has_prices boolean NOT NULL DEFAULT false;

-- history of our own prices (append-only; rows of an undone import are flagged, not deleted)
CREATE TABLE IF NOT EXISTS system_prices (
  id            bigserial PRIMARY KEY,
  company_id    bigint NOT NULL REFERENCES companies(id),
  product_id    bigint NOT NULL REFERENCES products(id),
  import_id     bigint REFERENCES imports(id),
  price_level1  bigint,
  price_level2  bigint,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  undone        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS system_prices_product_idx ON system_prices (product_id, recorded_at DESC);
