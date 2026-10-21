CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.notifications (assignment_id, substitute_id)
  SELECT p_assignment_id, p.id FROM public.profiles p
  WHERE p.approved AND p.background_status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = p_assignment_id AND d.substitute_id = p.id)
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_updated integer; v_ok boolean;
BEGIN
  SELECT (p.approved AND p.background_status = 'approved') INTO v_ok FROM public.profiles p WHERE p.id = auth.uid();
  IF v_ok IS NOT TRUE OR EXISTS (SELECT 1 FROM public.school_members WHERE user_id = auth.uid()) THEN RETURN 'not_approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_declines WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid()) THEN
    RETURN 'already_filled';
  END IF;
  UPDATE public.assignments SET status = 'filled', assigned_substitute_id = auth.uid(), assigned_at = now()
  WHERE id = p_assignment_id AND status = 'open';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN
    INSERT INTO public.notifications (assignment_id, substitute_id) VALUES (p_assignment_id, auth.uid()) ON CONFLICT DO NOTHING;
    PERFORM public.log_event('substitute_accepted', p_assignment_id, NULL, auth.uid());
  END IF;
  RETURN CASE WHEN v_updated = 1 THEN 'claimed' ELSE 'already_filled' END;
END $function$;

CREATE OR REPLACE FUNCTION public.log_assignment_view(p_assignment_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved AND background_status = 'approved')
     AND EXISTS (SELECT 1 FROM public.assignments WHERE id = p_assignment_id) THEN
    PERFORM public.log_event('notification_viewed', p_assignment_id, NULL, auth.uid());
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.log_notification_sent()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  SELECT a.school_id INTO v_school FROM public.assignments a WHERE a.id = NEW.assignment_id;
  PERFORM public.log_event('notification_sent', NEW.assignment_id, v_school, NEW.substitute_id);
  RETURN NEW;
END $function$;

-- Open assignments for approved substitutes; school contact only when assigned.
CREATE OR REPLACE FUNCTION public.substitute_assignments()
 RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time, description text, compensation text, status assignment_status, assigned_to_me boolean, school_name text, school_contact_person text, school_phone text, school_email text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation, a.status,
         a.assigned_substitute_id = auth.uid(), s.name,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.contact_person END,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.phone END,
         CASE WHEN a.assigned_substitute_id = auth.uid() THEN s.email END
  FROM public.assignments a JOIN public.schools s ON s.id = a.school_id
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved AND p.background_status = 'approved')
    AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = auth.uid())
    AND ((a.status = 'open' AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = a.id AND d.substitute_id = auth.uid()))
         OR a.assigned_substitute_id = auth.uid())
  ORDER BY a.assignment_date, a.start_time
$function$;
REVOKE EXECUTE ON FUNCTION public.substitute_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substitute_assignments() TO authenticated;

-- Substitutes only read school rows for assignments they hold.
DROP POLICY IF EXISTS schools_select_related ON public.schools;
CREATE POLICY schools_select_related ON public.schools FOR SELECT TO authenticated
USING (id = public.my_school_id() OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.school_id = schools.id AND a.assigned_substitute_id = auth.uid()));

DROP FUNCTION public.school_assignments();
CREATE FUNCTION public.school_assignments()
 RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time, description text, compensation text, status assignment_status, substitute_id uuid, substitute_name text, substitute_phone text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation,
         a.status, a.assigned_substitute_id, p.full_name, p.phone, a.created_at
  FROM public.assignments a LEFT JOIN public.profiles p ON p.id = a.assigned_substitute_id
  WHERE a.school_id = public.my_school_id()
  ORDER BY a.assignment_date DESC, a.start_time DESC
$function$;
GRANT EXECUTE ON FUNCTION public.school_assignments() TO authenticated;

DROP FUNCTION public.admin_assignment_metrics();
DROP VIEW public.assignment_metrics;
CREATE VIEW public.assignment_metrics WITH (security_invoker = true) AS
 SELECT a.id AS assignment_id, a.subject, s.name AS school_name, a.school_id, a.created_at,
    COALESCE(pub.published_at, a.created_at) AS published_at,
    (a.assignment_date + a.start_time) AS starts_at,
    (SELECT count(*) FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'notification_sent') AS notified_count,
    (SELECT count(DISTINCT e.substitute_ref) FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'notification_viewed') AS viewed_count,
    (SELECT count(DISTINCT e.substitute_ref) FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'substitute_accepted') AS accepted_count,
    (SELECT round(EXTRACT(epoch FROM (min(e.occurred_at) - COALESCE(pub.published_at, a.created_at))) / 60::numeric) FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'substitute_accepted') AS minutes_to_first_response,
    (SELECT round(EXTRACT(epoch FROM (min(e.occurred_at) - COALESCE(pub.published_at, a.created_at))) / 60::numeric) FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'assignment_filled') AS minutes_to_filled,
    a.status::text AS outcome,
    (SELECT round(avg(r.score), 1) FROM ratings r WHERE r.assignment_id = a.id) AS rating
   FROM assignments a JOIN schools s ON s.id = a.school_id
   LEFT JOIN LATERAL (SELECT min(e.occurred_at) AS published_at FROM event_log e WHERE e.assignment_id = a.id AND e.event_type = 'assignment_published') pub ON true;
REVOKE ALL ON public.assignment_metrics FROM anon, authenticated;
CREATE FUNCTION public.admin_assignment_metrics()
 RETURNS SETOF assignment_metrics LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  RETURN QUERY SELECT * FROM public.assignment_metrics ORDER BY created_at DESC;
END $function$;
REVOKE EXECUTE ON FUNCTION public.admin_assignment_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assignment_metrics() TO authenticated;

UPDATE public.event_log SET metadata = metadata - 'distance_km' - 'short_notice' WHERE event_type = 'notification_sent' AND (metadata ? 'distance_km' OR metadata ? 'short_notice');
UPDATE public.notifications SET distance_km = NULL WHERE distance_km IS NOT NULL;
COMMENT ON COLUMN public.notifications.distance_km IS 'DEPRECATED: distance matching removed';
COMMENT ON COLUMN public.schools.lat IS 'DEPRECATED: distance matching removed';
COMMENT ON COLUMN public.schools.lng IS 'DEPRECATED: distance matching removed';
COMMENT ON COLUMN public.profiles.lat IS 'DEPRECATED: distance matching removed';
COMMENT ON COLUMN public.profiles.lng IS 'DEPRECATED: distance matching removed';
COMMENT ON COLUMN public.profiles.postal_code IS 'DEPRECATED: no longer collected';
COMMENT ON COLUMN public.profiles.city IS 'DEPRECATED: no longer collected';
COMMENT ON COLUMN public.profiles.street_address IS 'DEPRECATED: no longer collected';

CREATE OR REPLACE FUNCTION public.validate_profile_contact()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF ROW(NEW.full_name,NEW.email,NEW.phone) IS NOT DISTINCT FROM ROW(OLD.full_name,OLD.email,OLD.phone) THEN RETURN NEW; END IF;
 IF coalesce(length(btrim(NEW.full_name)),0) NOT BETWEEN 1 AND 120 OR coalesce(length(NEW.email),0) > 255 OR coalesce(NEW.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(NEW.phone,'') !~ '^[+0-9 ()-]{5,40}$' OR length(regexp_replace(coalesce(NEW.phone,''),'[^0-9]','','g')) < 5 THEN RAISE EXCEPTION 'Fyll i namn, giltig e-post och telefonnummer.'; END IF;
 RETURN NEW;
END $function$;

UPDATE public.profiles SET postal_code = NULL, city = NULL, street_address = NULL, lat = NULL, lng = NULL
WHERE NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = profiles.id)
  AND (postal_code IS NOT NULL OR city IS NOT NULL OR street_address IS NOT NULL OR lat IS NOT NULL OR lng IS NOT NULL);
UPDATE public.schools SET lat = NULL, lng = NULL WHERE lat IS NOT NULL OR lng IS NOT NULL;

-- Notify all currently approved substitutes about existing open assignments.
INSERT INTO public.notifications (assignment_id, substitute_id)
SELECT a.id, p.id FROM public.assignments a CROSS JOIN public.profiles p
WHERE a.status = 'open' AND p.approved AND p.background_status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = a.id AND d.substitute_id = p.id)
ON CONFLICT DO NOTHING;