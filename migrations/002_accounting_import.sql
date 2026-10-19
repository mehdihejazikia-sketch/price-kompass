-- Accounting-system import: codes may be empty or shared by several products,
-- so internal_code is no longer unique. Identity is matched in the importer
-- (see src/lib/importDiff.ts). Products missing from a new file become
-- inactive (hidden from search, history kept).

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_company_id_internal_code_key;
ALTER TABLE products ALTER COLUMN internal_code SET DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS code_norm   text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_norm   text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order  int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS inactive_at timestamptz;
CREATE INDEX IF NOT EXISTS products_code_norm_idx ON products (company_id, code_norm);
CREATE INDEX IF NOT EXISTS products_name_norm_idx ON products (company_id, name_norm);

-- The saved "default import format" (column headers) per company.
CREATE TABLE IF NOT EXISTS import_formats (
  company_id  bigint PRIMARY KEY REFERENCES companies(id),
  columns     jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Import log + what each import changed (for undo).
CREATE TABLE IF NOT EXISTS imports (
  id           bigserial PRIMARY KEY,
  company_id   bigint NOT NULL REFERENCES companies(id),
  user_id      bigint REFERENCES users(id),
  file_name    text NOT NULL DEFAULT '',
  missing_mode text NOT NULL DEFAULT 'deactivate' CHECK (missing_mode IN ('deactivate', 'delete')),
  status       text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging', 'done', 'undone')),
  row_count    int NOT NULL DEFAULT 0,
  counts       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  undone_at    timestamptz,
  undone_by    bigint REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS imports_company_idx ON imports (company_id, created_at DESC);

-- Uploaded rows, sent from the browser in batches; cleared when the import finishes.
CREATE TABLE IF NOT EXISTS import_rows (
  import_id  bigint NOT NULL REFERENCES imports(id),
  idx        int NOT NULL,
  data       jsonb NOT NULL,
  PRIMARY KEY (import_id, idx)
);

CREATE TABLE IF NOT EXISTS import_changes (
  id          bigserial PRIMARY KEY,
  import_id   bigint NOT NULL REFERENCES imports(id),
  product_id  bigint NOT NULL REFERENCES products(id),
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'deactivate', 'delete')),
  before      jsonb
);
CREATE INDEX IF NOT EXISTS import_changes_import_idx ON import_changes (import_id);
