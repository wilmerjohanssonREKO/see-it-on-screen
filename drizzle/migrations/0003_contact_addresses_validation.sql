ALTER TABLE public.schools ADD COLUMN street_address text, ADD COLUMN postal_code text, ADD COLUMN city text;
ALTER TABLE public.profiles ADD COLUMN street_address text, ADD COLUMN postal_code text, ADD COLUMN city text;

CREATE OR REPLACE FUNCTION public.validate_school_contact() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND ROW(NEW.name,NEW.contact_person,NEW.email,NEW.phone,NEW.street_address,NEW.postal_code,NEW.city) IS NOT DISTINCT FROM ROW(OLD.name,OLD.contact_person,OLD.email,OLD.phone,OLD.street_address,OLD.postal_code,OLD.city) THEN RETURN NEW; END IF;
 IF coalesce(length(btrim(NEW.name)),0) NOT BETWEEN 1 AND 120 OR coalesce(length(btrim(NEW.contact_person)),0) NOT BETWEEN 1 AND 120 OR coalesce(length(NEW.email),0) > 255 OR coalesce(NEW.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(NEW.phone,'') !~ '^[+0-9 ()-]{5,40}$' OR length(regexp_replace(coalesce(NEW.phone,''),'[^0-9]','','g')) < 5 OR coalesce(length(btrim(NEW.street_address)),0) NOT BETWEEN 1 AND 200 OR coalesce(NEW.postal_code,'') !~ '^[0-9]{3} ?[0-9]{2}$' OR coalesce(length(btrim(NEW.city)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Fyll i skolans namn, kontaktperson, e-post, telefon och fullständiga adress.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_school_contact BEFORE INSERT OR UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.validate_school_contact();

CREATE OR REPLACE FUNCTION public.validate_profile_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF ROW(NEW.full_name,NEW.email,NEW.phone,NEW.street_address,NEW.postal_code,NEW.city,NEW.subjects) IS NOT DISTINCT FROM ROW(OLD.full_name,OLD.email,OLD.phone,OLD.street_address,OLD.postal_code,OLD.city,OLD.subjects) THEN RETURN NEW; END IF;
 IF coalesce(length(btrim(NEW.full_name)),0) NOT BETWEEN 1 AND 120 OR coalesce(length(NEW.email),0) > 255 OR coalesce(NEW.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(NEW.phone,'') !~ '^[+0-9 ()-]{5,40}$' OR length(regexp_replace(coalesce(NEW.phone,''),'[^0-9]','','g')) < 5 THEN RAISE EXCEPTION 'Fyll i namn, giltig e-post och telefonnummer.'; END IF;
 IF NEW.street_address IS NOT NULL OR NEW.postal_code IS NOT NULL OR NEW.city IS NOT NULL THEN
  IF coalesce(length(btrim(NEW.street_address)),0) NOT BETWEEN 1 AND 200 OR coalesce(NEW.postal_code,'') !~ '^[0-9]{3} ?[0-9]{2}$' OR coalesce(length(btrim(NEW.city)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Fyll i gatuadress, postnummer och ort.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_profile_contact BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_contact();
COMMENT ON COLUMN public.profiles.street_address IS 'Private contact address; existing accounts complete it on profile save. Not required for school or teacher accounts.';