ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Only admins may change the test flag
CREATE OR REPLACE FUNCTION public.protect_is_test()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_test AND NOT public.is_admin() THEN NEW.is_test := false; END IF;
  ELSIF NEW.is_test IS DISTINCT FROM OLD.is_test AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Endast admin kan ändra testläge';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_is_test_profiles ON public.profiles;
CREATE TRIGGER protect_is_test_profiles BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_is_test();
DROP TRIGGER IF EXISTS protect_is_test_schools ON public.schools;
CREATE TRIGGER protect_is_test_schools BEFORE INSERT OR UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.protect_is_test();

-- Same-mode helper: substitute and school must share test flag
CREATE OR REPLACE FUNCTION public.same_sandbox(p_substitute uuid, p_school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT p.is_test FROM public.profiles p WHERE p.id = p_substitute), false)
       = COALESCE((SELECT s.is_test FROM public.schools s WHERE s.id = p_school), false)
$$;

CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer; v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.assignments WHERE id = p_assignment_id;
  INSERT INTO public.notifications (assignment_id, substitute_id)
  SELECT p_assignment_id, p.id FROM public.profiles p
  WHERE p.approved AND p.background_status = 'approved'
    AND public.same_sandbox(p.id, v_school)
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = p_assignment_id AND d.substitute_id = p.id)
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer; v_ok boolean;
BEGIN
  SELECT (p.approved AND p.background_status = 'approved') INTO v_ok FROM public.profiles p WHERE p.id = auth.uid();
  IF v_ok IS NOT TRUE OR EXISTS (SELECT 1 FROM public.school_members WHERE user_id = auth.uid()) THEN RETURN 'not_approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_declines WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid()) THEN
    RETURN 'already_filled';
  END IF;
  UPDATE public.assignments a SET status = 'filled', assigned_substitute_id = auth.uid(), assigned_at = now()
  WHERE a.id = p_assignment_id AND a.status = 'open' AND public.same_sandbox(auth.uid(), a.school_id);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN
    INSERT INTO public.notifications (assignment_id, substitute_id) VALUES (p_assignment_id, auth.uid()) ON CONFLICT DO NOTHING;
    PERFORM public.log_event('substitute_accepted', p_assignment_id, NULL, auth.uid());
  END IF;
  RETURN CASE WHEN v_updated = 1 THEN 'claimed' ELSE 'already_filled' END;
END $$;

CREATE OR REPLACE FUNCTION public.substitute_assignments()
RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time without time zone, end_time time without time zone, description text, compensation text, status assignment_status, assigned_to_me boolean, school_name text, school_contact_person text, school_phone text, school_email text, school_rating_avg numeric, school_rating_count integer, completed boolean, rated boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation, a.status,
         a.assigned_substitute_id = auth.uid(), s.name,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.contact_person END,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.phone END,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.email END,
         (SELECT round(avg(sr.score), 1) FROM public.school_ratings sr WHERE sr.school_id = s.id),
         (SELECT count(*)::int FROM public.school_ratings sr WHERE sr.school_id = s.id),
         public.assignment_completed(a.id),
         EXISTS (SELECT 1 FROM public.school_ratings sr WHERE sr.assignment_id = a.id)
  FROM public.assignments a JOIN public.schools s ON s.id = a.school_id
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved AND p.background_status = 'approved' AND p.is_test = s.is_test)
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = auth.uid())
    AND ((a.status = 'open' AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = a.id AND d.substitute_id = auth.uid()))
         OR a.assigned_substitute_id = auth.uid())
  ORDER BY a.assignment_date, a.start_time
$$;

DROP POLICY IF EXISTS assignments_select_notified ON public.assignments;
CREATE POLICY assignments_select_notified ON public.assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved AND p.background_status = 'approved')
  AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = auth.uid())
  AND public.same_sandbox(auth.uid(), school_id)
  AND (status = 'open' OR assigned_substitute_id = auth.uid())
  AND (assigned_substitute_id = auth.uid() OR NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = assignments.id AND d.substitute_id = auth.uid()))
);

-- Test inbox: captured sandbox emails, never delivered
CREATE TABLE IF NOT EXISTS public.sandbox_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  template text NOT NULL,
  recipient text NOT NULL,
  assignment_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.sandbox_emails TO authenticated;
GRANT ALL ON public.sandbox_emails TO service_role;
ALTER TABLE public.sandbox_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY sandbox_emails_admin_select ON public.sandbox_emails FOR SELECT TO authenticated USING (public.is_admin());

-- Admin: purge only test data
CREATE OR REPLACE FUNCTION public.purge_sandbox_data()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[]; v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Endast admin'; END IF;
  SELECT coalesce(array_agg(a.id), '{}') INTO v_ids FROM public.assignments a JOIN public.schools s ON s.id = a.school_id WHERE s.is_test;
  DELETE FROM public.notifications WHERE assignment_id = ANY(v_ids);
  DELETE FROM public.assignment_declines WHERE assignment_id = ANY(v_ids);
  DELETE FROM public.ratings WHERE assignment_id = ANY(v_ids);
  DELETE FROM public.school_ratings WHERE assignment_id = ANY(v_ids);
  DELETE FROM public.event_log WHERE assignment_id = ANY(v_ids);
  DELETE FROM public.assignments WHERE id = ANY(v_ids);
  DELETE FROM public.sandbox_emails WHERE id IS NOT NULL;
  v_count := coalesce(array_length(v_ids, 1), 0);
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.purge_sandbox_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_sandbox_data() TO authenticated;

-- Admin: toggle test flag
CREATE OR REPLACE FUNCTION public.admin_set_test(p_kind text, p_id uuid, p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Endast admin'; END IF;
  IF p_kind = 'school' THEN UPDATE public.schools SET is_test = p_value WHERE id = p_id;
  ELSIF p_kind = 'substitute' THEN UPDATE public.profiles SET is_test = p_value WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Okänd typ'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_test(text, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_test(text, uuid, boolean) TO authenticated;