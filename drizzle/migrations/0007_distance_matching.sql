-- Coordinates for distance matching (geocoded from postal code + city)
ALTER TABLE public.schools ADD COLUMN lat double precision, ADD COLUMN lng double precision;
ALTER TABLE public.profiles ADD COLUMN lat double precision, ADD COLUMN lng double precision;
COMMENT ON COLUMN public.schools.lat IS 'Geocoded from postal_code + city, used for distance matching';
COMMENT ON COLUMN public.profiles.lat IS 'Geocoded from postal_code + city, used for distance matching. Private, never shown to schools.';

-- Distance stored per notification so the substitute can see "ca X km från skolan"
ALTER TABLE public.notifications ADD COLUMN distance_km numeric;

-- Distance-aware matching. Constants at the top are easy to tune:
-- SHORT_NOTICE_HOURS: assignments starting sooner than this count as short notice
-- SHORT_NOTICE_RADIUS_KM: on short notice only substitutes within this radius are notified first
-- MIN_NOTIFY: on short notice, if fewer than this many are within the radius, the nearest outside are notified too
CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  SHORT_NOTICE_HOURS constant integer := 24;
  SHORT_NOTICE_RADIUS_KM constant numeric := 15;
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

-- School page also shows the assigned substitute's distance (never their address)
DROP FUNCTION public.school_assignments();
CREATE FUNCTION public.school_assignments()
RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time, end_time time,
  description text, compensation text, status assignment_status, substitute_name text, substitute_phone text,
  substitute_distance_km numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.subject, a.assignment_date, a.start_time, a.end_time, a.description, a.compensation,
         a.status, p.full_name, p.phone,
         (SELECT n.distance_km FROM public.notifications n
          WHERE n.assignment_id = a.id AND n.substitute_id = a.assigned_substitute_id),
         a.created_at
  FROM public.assignments a LEFT JOIN public.profiles p ON p.id = a.assigned_substitute_id
  WHERE a.school_id = public.my_school_id()
  ORDER BY a.assignment_date DESC, a.start_time DESC
$$;
REVOKE EXECUTE ON FUNCTION public.school_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_assignments() TO authenticated;