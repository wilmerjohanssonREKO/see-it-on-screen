ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text, ADD COLUMN IF NOT EXISTS avatar_consent_at timestamptz;

CREATE TABLE public.school_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.assignments(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.school_ratings TO authenticated;
GRANT ALL ON public.school_ratings TO service_role;
ALTER TABLE public.school_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_ratings_select_receiver_or_admin ON public.school_ratings FOR SELECT TO authenticated
  USING (public.is_admin() OR school_id = public.my_school_id());
CREATE POLICY school_ratings_admin_delete ON public.school_ratings FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY ratings_select_own ON public.ratings FOR SELECT TO authenticated USING (substitute_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_school_rating_given()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.log_event('rating_given', NEW.assignment_id, NEW.school_id, NEW.substitute_id,
    jsonb_build_object('score', NEW.score, 'direction', 'substitute_to_school'));
  RETURN NEW;
END $$;
CREATE TRIGGER school_ratings_log_given AFTER INSERT ON public.school_ratings FOR EACH ROW EXECUTE FUNCTION public.log_school_rating_given();

CREATE OR REPLACE FUNCTION public.log_rating_given()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.assignments WHERE id = NEW.assignment_id;
  PERFORM public.log_event('rating_given', NEW.assignment_id, v_school, NEW.substitute_id,
    jsonb_build_object('score', NEW.score, 'direction', 'school_to_substitute'));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.assignment_completed(p_assignment_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = p_assignment_id AND a.status = 'filled'
    AND a.assigned_substitute_id IS NOT NULL
    AND ((a.assignment_date + a.end_time) AT TIME ZONE 'Europe/Stockholm') < now())
$$;

CREATE OR REPLACE FUNCTION public.rate_substitute(p_assignment_id uuid, p_score integer, p_comment text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id;
  IF v_school IS NULL OR v_school IS DISTINCT FROM public.my_school_id() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF v_sub IS NULL OR v_sub = auth.uid() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF NOT public.assignment_completed(p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget är inte genomfört än'; END IF;
  IF p_score NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Betyget måste vara 1–5'; END IF;
  IF EXISTS (SELECT 1 FROM public.ratings WHERE assignment_id = p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget har redan betygsatts'; END IF;
  INSERT INTO public.ratings (substitute_id, assignment_id, score, comment)
  VALUES (v_sub, p_assignment_id, p_score, left(nullif(btrim(p_comment), ''), 500));
END $$;

CREATE OR REPLACE FUNCTION public.rate_school(p_assignment_id uuid, p_score integer, p_comment text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id;
  IF v_sub IS NULL OR v_sub <> auth.uid() OR v_school = public.my_school_id() THEN RAISE EXCEPTION 'Du får inte betygsätta detta uppdrag'; END IF;
  IF NOT public.assignment_completed(p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget är inte genomfört än'; END IF;
  IF p_score NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Betyget måste vara 1–5'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_ratings WHERE assignment_id = p_assignment_id) THEN RAISE EXCEPTION 'Uppdraget har redan betygsatts'; END IF;
  INSERT INTO public.school_ratings (school_id, assignment_id, substitute_id, score, comment)
  VALUES (v_school, p_assignment_id, v_sub, p_score, left(nullif(btrim(p_comment), ''), 500));
END $$;

CREATE OR REPLACE FUNCTION public.my_rating_summary()
 RETURNS TABLE(avg_score numeric, rating_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT round(avg(score), 1), count(*)::int FROM public.ratings WHERE substitute_id = auth.uid() $$;

-- Can the caller see this substitute's avatar? self, admin, or school with an assignment they took or were declined from.
CREATE OR REPLACE FUNCTION public.can_view_substitute(p_substitute uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p_substitute = auth.uid() OR COALESCE(public.is_admin(), false)
    OR (public.my_school_id() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.school_id = public.my_school_id() AND a.assigned_substitute_id = p_substitute)
      OR EXISTS (SELECT 1 FROM public.assignment_declines d JOIN public.assignments a ON a.id = d.assignment_id
                 WHERE a.school_id = public.my_school_id() AND d.substitute_id = p_substitute)))
$$;

DROP FUNCTION public.school_assignments();
CREATE FUNCTION public.school_assignments()
 RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time, description text, compensation text, status assignment_status, substitute_id uuid, substitute_name text, substitute_phone text, substitute_rating_avg numeric, substitute_rating_count integer, completed boolean, rated boolean, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation,
         a.status, a.assigned_substitute_id, p.full_name, p.phone,
         (SELECT round(avg(r.score), 1) FROM public.ratings r WHERE r.substitute_id = a.assigned_substitute_id),
         (SELECT count(*)::int FROM public.ratings r WHERE r.substitute_id = a.assigned_substitute_id),
         public.assignment_completed(a.id),
         EXISTS (SELECT 1 FROM public.ratings r WHERE r.assignment_id = a.id),
         a.created_at
  FROM public.assignments a LEFT JOIN public.profiles p ON p.id = a.assigned_substitute_id
  WHERE a.school_id = public.my_school_id()
  ORDER BY a.assignment_date DESC, a.start_time DESC
$$;

DROP FUNCTION public.substitute_assignments();
CREATE FUNCTION public.substitute_assignments()
 RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time, description text, compensation text, status assignment_status, assigned_to_me boolean, school_name text, school_contact_person text, school_phone text, school_email text, school_rating_avg numeric, school_rating_count integer, completed boolean, rated boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved AND p.background_status = 'approved')
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = auth.uid())
    AND ((a.status = 'open' AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = a.id AND d.substitute_id = auth.uid()))
         OR a.assigned_substitute_id = auth.uid())
  ORDER BY a.assignment_date, a.start_time
$$;

REVOKE EXECUTE ON FUNCTION public.school_assignments(), public.substitute_assignments(), public.rate_substitute(uuid,integer,text), public.rate_school(uuid,integer,text), public.my_rating_summary(), public.can_view_substitute(uuid), public.assignment_completed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_assignments(), public.substitute_assignments(), public.rate_substitute(uuid,integer,text), public.rate_school(uuid,integer,text), public.my_rating_summary(), public.can_view_substitute(uuid), public.assignment_completed(uuid) TO authenticated;

CREATE POLICY avatars_own_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_own_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_own_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_own_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);