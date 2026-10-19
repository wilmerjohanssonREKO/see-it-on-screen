CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Secret HMAC key for pseudonyms: server-side only, no grants to app roles.
CREATE TABLE public.log_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL
);
GRANT ALL ON public.log_config TO service_role;
ALTER TABLE public.log_config ENABLE ROW LEVEL SECURITY;

-- Event log: admin reads only, writes only via SECURITY DEFINER functions.
CREATE TABLE public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  assignment_id uuid,
  school_id uuid,
  substitute_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.event_log TO authenticated;
GRANT ALL ON public.event_log TO service_role;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_log_admin_select ON public.event_log FOR SELECT TO authenticated USING (public.is_admin());
COMMENT ON TABLE public.event_log IS 'Pseudonymiserad händelselogg för statistik. Inga namn, e-post, telefon eller postnummer. substitute_ref är en HMAC-hash.';

-- Central logging helper: computes the HMAC pseudonym, never callable by users.
CREATE OR REPLACE FUNCTION public.log_event(p_event_type text, p_assignment_id uuid DEFAULT NULL, p_school_id uuid DEFAULT NULL, p_substitute_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text; v_ref text;
BEGIN
  IF p_substitute_id IS NOT NULL THEN
    INSERT INTO public.log_config (id, secret) VALUES (true, encode(gen_random_bytes(32), 'hex')) ON CONFLICT (id) DO NOTHING;
    SELECT secret INTO v_secret FROM public.log_config WHERE id = true;
    v_ref := encode(hmac(p_substitute_id::text, v_secret, 'sha256'), 'hex');
  END IF;
  INSERT INTO public.event_log (event_type, assignment_id, school_id, substitute_ref, metadata)
  VALUES (p_event_type, p_assignment_id, p_school_id, v_ref, COALESCE(p_metadata, '{}'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.log_event(text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Assignment lifecycle events.
CREATE OR REPLACE FUNCTION public.log_assignment_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event('assignment_created', NEW.id, NEW.school_id);
    IF NEW.status = 'open' THEN
      PERFORM public.log_event('assignment_published', NEW.id, NEW.school_id);
    END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'open' AND OLD.status <> 'open' THEN
      PERFORM public.log_event('assignment_published', NEW.id, NEW.school_id);
    ELSIF NEW.status = 'filled' THEN
      PERFORM public.log_event('assignment_filled', NEW.id, NEW.school_id, NEW.assigned_substitute_id);
    ELSIF NEW.status = 'expired' THEN
      PERFORM public.log_event('assignment_expired', NEW.id, NEW.school_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assignments_log_events AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_assignment_events();

-- Notification events with distance and short-notice flag.
CREATE OR REPLACE FUNCTION public.log_notification_sent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_short boolean; v_school uuid;
BEGIN
  SELECT ((a.assignment_date + a.start_time) AT TIME ZONE 'Europe/Stockholm') < now() + interval '2 hours', a.school_id
    INTO v_short, v_school
  FROM public.assignments a WHERE a.id = NEW.assignment_id;
  PERFORM public.log_event('notification_sent', NEW.assignment_id, v_school, NEW.substitute_id,
    jsonb_build_object('distance_km', NEW.distance_km, 'short_notice', COALESCE(v_short, false)));
  RETURN NEW;
END $$;
CREATE TRIGGER notifications_log_sent AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.log_notification_sent();

-- Candidate rejected (school declined a substitute).
CREATE OR REPLACE FUNCTION public.log_candidate_rejected()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.assignments WHERE id = NEW.assignment_id;
  PERFORM public.log_event('candidate_rejected', NEW.assignment_id, v_school, NEW.substitute_id);
  RETURN NEW;
END $$;
CREATE TRIGGER declines_log_rejected AFTER INSERT ON public.assignment_declines
  FOR EACH ROW EXECUTE FUNCTION public.log_candidate_rejected();

-- Rating events (score only, never free text).
CREATE OR REPLACE FUNCTION public.log_rating_given()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.assignments WHERE id = NEW.assignment_id;
  PERFORM public.log_event('rating_given', NEW.assignment_id, v_school, NEW.substitute_id,
    jsonb_build_object('score', NEW.score));
  RETURN NEW;
END $$;
CREATE TRIGGER ratings_log_given AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.log_rating_given();

-- Log the "Jag kan" click on a successful claim.
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
  IF v_updated = 1 THEN
    PERFORM public.log_event('substitute_accepted', p_assignment_id, NULL, auth.uid());
  END IF;
  RETURN CASE WHEN v_updated = 1 THEN 'claimed' ELSE 'already_filled' END;
END $$;

-- Log when a substitute opens an assignment they were notified about.
CREATE OR REPLACE FUNCTION public.log_assignment_view(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid()) THEN
    PERFORM public.log_event('notification_viewed', p_assignment_id, NULL, auth.uid());
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_assignment_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_assignment_view(uuid) TO authenticated;

-- Matching rules: short notice is now 2 hours, radius 10 km.
CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  SHORT_NOTICE_HOURS constant integer := 2;
  SHORT_NOTICE_RADIUS_KM constant numeric := 10;
  MIN_NOTIFY constant integer := 3;
  v_subject text;
  v_lat double precision;
  v_lng double precision;
  v_start timestamptz;
  v_short boolean;
  v_count integer;
BEGIN
  SELECT a.subject, s.lat, s.lng, (a.assignment_date + a.start_time) AT TIME ZONE 'Europe/Stockholm'
    INTO v_subject, v_lat, v_lng, v_start
  FROM public.assignments a
  JOIN public.schools s ON s.id = a.school_id
  WHERE a.id = p_assignment_id;

  v_short := v_start < now() + make_interval(hours => SHORT_NOTICE_HOURS);

  WITH cand AS (
    SELECT p.id,
      CASE WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL AND p.lat IS NOT NULL AND p.lng IS NOT NULL THEN
        6371 * 2 * asin(sqrt(
          power(sin(radians((p.lat - v_lat) / 2)), 2)
          + cos(radians(v_lat)) * cos(radians(p.lat))
          * power(sin(radians((p.lng - v_lng) / 2)), 2)
        ))
      END AS dist
    FROM public.profiles p
    WHERE p.approved AND p.background_status = 'approved' AND v_subject = ANY (p.subjects)
      AND NOT EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id = p_assignment_id AND d.substitute_id = p.id)
  ),
  within AS (
    SELECT id, dist FROM cand
    WHERE NOT v_short OR (dist IS NOT NULL AND dist <= SHORT_NOTICE_RADIUS_KM)
    ORDER BY dist ASC NULLS LAST
  ),
  filler AS (
    SELECT id, dist FROM cand
    WHERE v_short AND (dist IS NULL OR dist > SHORT_NOTICE_RADIUS_KM)
      AND (SELECT count(*) FROM within) < MIN_NOTIFY
    ORDER BY dist ASC NULLS LAST
    LIMIT GREATEST(0, MIN_NOTIFY - (SELECT count(*) FROM within))
  )
  INSERT INTO public.notifications (assignment_id, substitute_id, distance_km)
  SELECT p_assignment_id, t.id, round(t.dist::numeric, 1)
  FROM (SELECT * FROM within UNION ALL SELECT * FROM filler) t
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_matching(uuid) FROM PUBLIC, anon, authenticated;

-- Per-assignment metrics view (read via admin_assignment_metrics only).
CREATE OR REPLACE VIEW public.assignment_metrics AS
SELECT
  a.id AS assignment_id,
  a.subject,
  s.name AS school_name,
  a.school_id,
  a.created_at,
  COALESCE(pub.published_at, a.created_at) AS published_at,
  (a.assignment_date + a.start_time) AS starts_at,
  ((a.assignment_date + a.start_time) AT TIME ZONE 'Europe/Stockholm') < COALESCE(pub.published_at, a.created_at) + interval '2 hours' AS short_notice,
  (SELECT count(*) FROM public.event_log e WHERE e.assignment_id = a.id AND e.event_type = 'notification_sent') AS notified_count,
  (SELECT count(DISTINCT e.substitute_ref) FROM public.event_log e WHERE e.assignment_id = a.id AND e.event_type = 'notification_viewed') AS viewed_count,
  (SELECT count(DISTINCT e.substitute_ref) FROM public.event_log e WHERE e.assignment_id = a.id AND e.event_type = 'substitute_accepted') AS accepted_count,
  (SELECT round(extract(epoch FROM (min(e.occurred_at) - COALESCE(pub.published_at, a.created_at))) / 60)
     FROM public.event_log e WHERE e.assignment_id = a.id AND e.event_type = 'substitute_accepted') AS minutes_to_first_response,
  (SELECT round(extract(epoch FROM (min(e.occurred_at) - COALESCE(pub.published_at, a.created_at))) / 60)
     FROM public.event_log e WHERE e.assignment_id = a.id AND e.event_type = 'assignment_filled') AS minutes_to_filled,
  (SELECT n.distance_km FROM public.notifications n WHERE n.assignment_id = a.id AND n.substitute_id = a.assigned_substitute_id) AS filled_distance_km,
  (SELECT round(avg((e.metadata->>'distance_km')::numeric), 1) FROM public.event_log e
     WHERE e.assignment_id = a.id AND e.event_type = 'notification_sent' AND e.metadata->>'distance_km' IS NOT NULL) AS avg_notified_distance_km,
  a.status::text AS outcome,
  (SELECT round(avg(r.score)::numeric, 1) FROM public.ratings r WHERE r.assignment_id = a.id) AS rating
FROM public.assignments a
JOIN public.schools s ON s.id = a.school_id
LEFT JOIN LATERAL (
  SELECT min(e.occurred_at) AS published_at FROM public.event_log e
  WHERE e.assignment_id = a.id AND e.event_type = 'assignment_published'
) pub ON true;
GRANT SELECT ON public.assignment_metrics TO service_role;

-- Admin-only reads and retention, enforced server-side.
CREATE OR REPLACE FUNCTION public.admin_assignment_metrics()
RETURNS SETOF public.assignment_metrics LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  RETURN QUERY SELECT * FROM public.assignment_metrics ORDER BY created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_assignment_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assignment_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_event_log()
RETURNS TABLE(id uuid, occurred_at timestamptz, event_type text, assignment_id uuid, school_id uuid, substitute_ref text, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  RETURN QUERY SELECT e.id, e.occurred_at, e.event_type, e.assignment_id, e.school_id, e.substitute_ref, e.metadata
    FROM public.event_log e ORDER BY e.occurred_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_event_log() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_event_log() TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_old_event_log()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  DELETE FROM public.event_log WHERE occurred_at < now() - interval '12 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.purge_old_event_log() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_old_event_log() TO authenticated;