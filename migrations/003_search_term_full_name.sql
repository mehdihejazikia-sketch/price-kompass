-- Search the shops with the cleaned product name instead of the bare model
-- code ("M-90" found headphones instead of the Logitech mouse). Only rows whose
-- search term was set automatically (empty or equal to the model) are changed;
-- search terms typed by hand stay as they are.
UPDATE products
   SET search_term = btrim(regexp_replace(regexp_replace(translate(name, 'يىك', 'ییک'), '[​-‏﻿]', '', 'g'), '\s+', ' ', 'g')),
       updated_at = now()
 WHERE deleted_at IS NULL
   AND (search_term = '' OR search_term = model);
