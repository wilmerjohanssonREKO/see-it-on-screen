CREATE OR REPLACE FUNCTION public.validate_private_profile_paths()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cv_file_path IS NOT NULL AND (split_part(NEW.cv_file_path, '/', 1) <> NEW.id::text OR array_length(string_to_array(NEW.cv_file_path, '/'), 1) <> 2 OR split_part(NEW.cv_file_path, '/', 2) IN ('', '..') OR position(chr(92) in NEW.cv_file_path) > 0) THEN
    RAISE EXCEPTION 'CV-filens sökväg är inte tillåten';
  END IF;
  IF NEW.avatar_path IS NOT NULL AND (split_part(NEW.avatar_path, '/', 1) <> NEW.id::text OR array_length(string_to_array(NEW.avatar_path, '/'), 1) <> 2 OR split_part(NEW.avatar_path, '/', 2) IN ('', '..') OR position(chr(92) in NEW.avatar_path) > 0) THEN
    RAISE EXCEPTION 'Profilbildens sökväg är inte tillåten';
  END IF;
  RETURN NEW;
END $$;