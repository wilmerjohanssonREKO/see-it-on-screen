CREATE TABLE public.assignment_declines (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, substitute_id)
);
GRANT ALL ON public.assignment_declines TO service_role;
ALTER TABLE public.assignment_declines ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_subject text; v_count integer;
BEGIN
  SELECT subject INTO v_subject FROM public.assignments WHERE id = p_assignment_id;
  INSERT INTO public.notifications (assignment_id, substitute_id)
  SELECT p_assignment_id, p.id FROM public.profiles p
  WHERE p.approved AND p.background_status = 'approved' AND v_subject = ANY (p.subjects)
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = p_assignment_id AND d.substitute_id = p.id)
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_matching(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_school(p_school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.is_admin(), false) OR (p_school IS NOT NULL AND p_school IS NOT DISTINCT FROM public.my_school_id() AND public.my_school_id() IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.publish_assignment(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_count integer;
BEGIN
  SELECT school_id INTO v_school FROM public.assignments WHERE id = p_assignment_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
  IF NOT public.can_manage_school(v_school) THEN RAISE EXCEPTION 'Du får inte publicera detta uppdrag'; END IF;
  v_count := public.notify_matching(p_assignment_id);
  UPDATE public.assignments SET published_at = COALESCE(published_at, now()) WHERE id = p_assignment_id;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.create_and_publish_assignment(
  p_subject text, p_date date, p_start time, p_end time, p_compensation text, p_description text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid := public.my_school_id(); v_id uuid; v_count integer;
BEGIN
  IF v_school IS NULL THEN RAISE EXCEPTION 'Endast skolkonton kan publicera'; END IF;
  IF p_end <= p_start THEN RAISE EXCEPTION 'Sluttiden måste vara efter starttiden'; END IF;
  INSERT INTO public.assignments (school_id, subject, assignment_date, start_time, end_time, compensation, description, created_by, published_at)
  VALUES (v_school, p_subject, p_date, p_start, p_end, left(nullif(trim(p_compensation),''),120), left(nullif(trim(p_description),''),1000), auth.uid(), now())
  RETURNING id INTO v_id;
  v_count := public.notify_matching(v_id);
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.create_and_publish_assignment(text,date,time,time,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_substitute(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
  IF NOT public.can_manage_school(v_school) THEN RAISE EXCEPTION 'Du får inte ändra detta uppdrag'; END IF;
  IF v_sub IS NULL THEN RETURN false; END IF;
  INSERT INTO public.assignment_declines (assignment_id, substitute_id) VALUES (p_assignment_id, v_sub) ON CONFLICT DO NOTHING;
  DELETE FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = v_sub;
  UPDATE public.assignments SET status = 'open', assigned_substitute_id = NULL, assigned_at = NULL WHERE id = p_assignment_id;
  PERFORM public.notify_matching(p_assignment_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer; v_ok boolean;
BEGIN
  SELECT (p.approved AND p.background_status = 'approved' AND a.subject = ANY (p.subjects)) INTO v_ok
  FROM public.profiles p, public.assignments a WHERE p.id = auth.uid() AND a.id = p_assignment_id;
  IF v_ok IS NOT TRUE THEN RETURN 'not_approved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.assignment_declines WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid()) THEN
    RETURN 'already_filled';
  END IF;
  UPDATE public.assignments SET status = 'filled', assigned_substitute_id = auth.uid(), assigned_at = now()
  WHERE id = p_assignment_id AND status = 'open';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN CASE WHEN v_updated = 1 THEN 'claimed' ELSE 'already_filled' END;
END $$;

-- Schools/teachers may no longer edit assignments directly; they use the functions above.
DROP POLICY IF EXISTS assignments_school_update ON public.assignments;
DROP POLICY IF EXISTS assignments_school_insert ON public.assignments;

-- Only admin, the school itself, or substitutes linked to one of its assignments can read a school.
DROP POLICY IF EXISTS schools_select_authenticated ON public.schools;
CREATE POLICY schools_select_related ON public.schools FOR SELECT TO authenticated USING (
  id = public.my_school_id() OR EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.school_id = schools.id AND (
      a.assigned_substitute_id = auth.uid() OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.assignment_id = a.id AND n.substitute_id = auth.uid()))));

DROP POLICY IF EXISTS ratings_select_authenticated ON public.ratings;
COMMENT ON TABLE public.ratings IS 'DEPRECATED: ratings removed from MVP; admin-only access';
DROP POLICY IF EXISTS school_requests_insert_anyone ON public.school_requests;
COMMENT ON TABLE public.school_requests IS 'DEPRECATED: public request form retired; historical data kept';

-- Approval fields can never be self-set; a new background file resets the check to pending.
CREATE OR REPLACE FUNCTION public.protect_profile_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approved := false; NEW.background_status := 'pending';
    ELSE
      NEW.approved := OLD.approved;
      NEW.background_status := OLD.background_status;
      IF NEW.background_file_path IS DISTINCT FROM OLD.background_file_path THEN
        NEW.background_status := 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_approval_insert ON public.profiles;
CREATE TRIGGER protect_profile_approval_insert BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_approval();