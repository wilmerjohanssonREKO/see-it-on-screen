REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;

ALTER POLICY assignments_select_notified ON public.assignments USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved AND p.background_status = 'approved')
  AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = auth.uid())
  AND (status = 'open' OR assigned_substitute_id = auth.uid())
  AND (assigned_substitute_id = auth.uid() OR NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = assignments.id AND d.substitute_id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.validate_private_profile_paths()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cv_file_path IS NOT NULL AND (split_part(NEW.cv_file_path, '/', 1) <> NEW.id::text OR NEW.cv_file_path LIKE '%..%') THEN
    RAISE EXCEPTION 'Chemin CV non autorisé';
  END IF;
  IF NEW.avatar_path IS NOT NULL AND (split_part(NEW.avatar_path, '/', 1) <> NEW.id::text OR NEW.avatar_path LIKE '%..%') THEN
    RAISE EXCEPTION 'Profilbildens sökväg är inte tillåten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_private_profile_paths BEFORE INSERT OR UPDATE OF cv_file_path, avatar_path ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_private_profile_paths();

CREATE OR REPLACE FUNCTION public.rate_substitute(p_assignment_id uuid, p_score integer, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id FOR UPDATE;
  IF v_school IS NULL OR v_school IS DISTINCT FROM public.my_school_id() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF v_sub IS NULL OR v_sub = auth.uid() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF NOT public.assignment_completed(p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget är inte genomfört än'; END IF;
  IF p_score IS NULL OR p_score NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Betyget måste vara 1–5'; END IF;
  IF EXISTS (SELECT 1 FROM public.ratings WHERE assignment_id = p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget har redan betygsatts'; END IF;
  INSERT INTO public.ratings (substitute_id, assignment_id, score, comment) VALUES (v_sub, p_assignment_id, p_score, left(nullif(btrim(p_comment), ''), 500));
END $$;

CREATE OR REPLACE FUNCTION public.rate_school(p_assignment_id uuid, p_score integer, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id FOR UPDATE;
  IF auth.uid() IS NULL OR v_sub IS NULL OR v_sub <> auth.uid() OR v_school = public.my_school_id() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF NOT public.assignment_completed(p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget är inte genomfört än'; END IF;
  IF p_score IS NULL OR p_score NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Betyget måste vara 1–5'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_ratings WHERE assignment_id = p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget har redan betygsatts'; END IF;
  INSERT INTO public.school_ratings (school_id, assignment_id, substitute_id, score, comment) VALUES (v_school, p_assignment_id, v_sub, p_score, left(nullif(btrim(p_comment), ''), 500));
END $$;

CREATE OR REPLACE FUNCTION public.decline_substitute(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id FOR UPDATE;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
  IF NOT public.can_manage_school(v_school) THEN RAISE EXCEPTION 'Du får inte ändra detta uppdrag'; END IF;
  IF v_sub IS NULL THEN RETURN false; END IF;
  INSERT INTO public.assignment_declines (assignment_id, substitute_id) VALUES (p_assignment_id, v_sub) ON CONFLICT DO NOTHING;
  DELETE FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = v_sub;
  UPDATE public.assignments SET status = 'open', assigned_substitute_id = NULL, assigned_at = NULL WHERE id = p_assignment_id;
  PERFORM public.notify_matching(p_assignment_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.log_assignment_view(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved AND background_status = 'approved')
    AND NOT EXISTS (SELECT 1 FROM public.school_members WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = p_assignment_id AND
      (a.assigned_substitute_id = auth.uid() OR (a.status = 'open' AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = a.id AND d.substitute_id = auth.uid())))) THEN
    PERFORM public.log_event('notification_viewed', p_assignment_id, NULL, auth.uid());
  END IF;
END $$;