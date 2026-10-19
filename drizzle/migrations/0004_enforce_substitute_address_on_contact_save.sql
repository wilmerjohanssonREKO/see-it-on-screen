CREATE OR REPLACE FUNCTION public.validate_profile_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF ROW(NEW.full_name,NEW.email,NEW.phone,NEW.street_address,NEW.postal_code,NEW.city,NEW.subjects) IS NOT DISTINCT FROM ROW(OLD.full_name,OLD.email,OLD.phone,OLD.street_address,OLD.postal_code,OLD.city,OLD.subjects) THEN RETURN NEW; END IF;
 IF coalesce(length(btrim(NEW.full_name)),0) NOT BETWEEN 1 AND 120 OR coalesce(length(NEW.email),0) > 255 OR coalesce(NEW.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(NEW.phone,'') !~ '^[+0-9 ()-]{5,40}$' OR length(regexp_replace(coalesce(NEW.phone,''),'[^0-9]','','g')) < 5 THEN RAISE EXCEPTION 'Fyll i namn, giltig e-post och telefonnummer.'; END IF;
 IF (auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.school_members WHERE user_id = NEW.id)) OR NEW.street_address IS NOT NULL OR NEW.postal_code IS NOT NULL OR NEW.city IS NOT NULL THEN
  IF coalesce(length(btrim(NEW.street_address)),0) NOT BETWEEN 1 AND 200 OR coalesce(NEW.postal_code,'') !~ '^[0-9]{3} ?[0-9]{2}$' OR coalesce(length(btrim(NEW.city)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Fyll i gatuadress, postnummer och ort.'; END IF;
 END IF;
 RETURN NEW;
END $$;