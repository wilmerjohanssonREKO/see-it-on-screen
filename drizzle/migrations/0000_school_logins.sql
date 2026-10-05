CREATE TABLE public.school_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_members TO authenticated;
GRANT ALL ON public.school_members TO service_role;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_members_select ON public.school_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.my_school_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.school_members WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_school_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_school_id() TO authenticated;

CREATE POLICY assignments_school_select ON public.assignments FOR SELECT TO authenticated
  USING (school_id = public.my_school_id());
CREATE POLICY assignments_school_insert ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (school_id = public.my_school_id() AND assigned_substitute_id IS NULL);
CREATE POLICY assignments_school_update ON public.assignments FOR UPDATE TO authenticated
  USING (school_id = public.my_school_id()) WITH CHECK (school_id = public.my_school_id());

CREATE OR REPLACE FUNCTION public.publish_assignment(p_assignment_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_subject text; v_school uuid; v_count integer;
BEGIN
  SELECT subject, school_id INTO v_subject, v_school FROM public.assignments WHERE id = p_assignment_id;
  IF v_subject IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
  IF NOT (public.is_admin() OR v_school = public.my_school_id()) THEN
    RAISE EXCEPTION 'Du får inte publicera detta uppdrag';
  END IF;
  INSERT INTO public.notifications (assignment_id, substitute_id)
  SELECT p_assignment_id, p.id FROM public.profiles p
  WHERE p.approved = true AND p.background_status = 'approved' AND v_subject = ANY (p.subjects)
  ON CONFLICT DO NOTHING;
  UPDATE public.assignments SET published_at = COALESCE(published_at, now()) WHERE id = p_assignment_id;
  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END;
$function$;

-- Schools may see the name of the substitute assigned to their own assignments
CREATE OR REPLACE FUNCTION public.school_assignments()
RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time,
  description text, compensation text, status assignment_status, substitute_name text, substitute_phone text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation,
         a.status, p.full_name, p.phone, a.created_at
  FROM public.assignments a LEFT JOIN public.profiles p ON p.id = a.assigned_substitute_id
  WHERE a.school_id = public.my_school_id()
  ORDER BY a.assignment_date DESC, a.start_time DESC
$$;
REVOKE EXECUTE ON FUNCTION public.school_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_assignments() TO authenticated;