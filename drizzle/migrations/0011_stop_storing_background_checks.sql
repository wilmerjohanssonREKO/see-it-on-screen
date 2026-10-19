DROP POLICY IF EXISTS bg_own_insert ON storage.objects;
DROP POLICY IF EXISTS bg_own_update ON storage.objects;
COMMENT ON COLUMN public.profiles.background_file_path IS 'DEPRECATED: criminal record extracts are no longer stored; admin views the original and only background_status is kept.';