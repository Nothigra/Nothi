-- 023 — Real file facts on the public product page (instead of hard-coded sample values).
-- file_size / format are filled by the upload flow; older products get their format from the stored file name.
update public.products
   set format = upper(substring(file_path from '\.([A-Za-z0-9]+)$'))
 where format is null and file_path is not null and file_path ~ '\.[A-Za-z0-9]+$';

-- public_products: same definition as before, plus p.file_size and p.format at the end
-- (applied with CREATE OR REPLACE VIEW — see the project's migration history for the full text).
