-- "Models" that are really sizes (1.5m, 20v, 65W, 16GB…) were taken from product names by
-- the old extraction; they are not model codes and misled the matching. Cleared (the name keeps them).
UPDATE products
   SET model = '', updated_at = now()
 WHERE deleted_at IS NULL
   AND replace(model, '-', '') ~* '^\d+([.,]\d+)?(m|cm|mm|v|a|ah|w|g|gb|tb|mb|mah|hz|ghz|k|inch|in|mp|ms)$';
