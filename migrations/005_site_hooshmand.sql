-- Fourth shop: hooshmandco.com (pinned product page per product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS url_hooshmand text;
