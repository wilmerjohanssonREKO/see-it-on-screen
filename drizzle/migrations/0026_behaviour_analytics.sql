CREATE TABLE public.behaviour_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  page_view_id uuid NOT NULL,
  path text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('pageview','click','rage_click','dead_click','move','scroll','leave','form_start','form_submit','form_abandon')),
  element text,
  x real,
  y real,
  value real,
  device text NOT NULL CHECK (device IN ('mobile','tablet','desktop')),
  viewport_w integer
);
GRANT ALL ON public.behaviour_events TO service_role;
ALTER TABLE public.behaviour_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX behaviour_events_time_idx ON public.behaviour_events (occurred_at);
CREATE INDEX behaviour_events_path_idx ON public.behaviour_events (path, event_type, occurred_at);

CREATE OR REPLACE FUNCTION public.record_behaviour_events(p_events jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) > 60 THEN RETURN 0; END IF;
  INSERT INTO public.behaviour_events (session_id, page_view_id, path, event_type, element, x, y, value, device, viewport_w)
  SELECT (e->>'s')::uuid, (e->>'p')::uuid, left(e->>'path', 120), e->>'t',
         left(nullif(e->>'el',''), 120),
         least(greatest((e->>'x')::real, 0), 1), least(greatest((e->>'y')::real, 0), 1),
         least(greatest((e->>'v')::real, 0), 86400000),
         e->>'d', least(greatest((e->>'w')::integer, 0), 10000)
  FROM jsonb_array_elements(p_events) e
  WHERE e->>'path' LIKE '/%'
    AND e->>'t' IN ('pageview','click','rage_click','dead_click','move','scroll','leave','form_start','form_submit','form_abandon')
    AND e->>'d' IN ('mobile','tablet','desktop')
    AND (e->>'s') ~ '^[0-9a-f-]{36}$' AND (e->>'p') ~ '^[0-9a-f-]{36}$';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.record_behaviour_events(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_behaviour_events(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_behaviour_summary(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => least(greatest(p_days,1),90));
  result jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  DELETE FROM public.behaviour_events WHERE occurred_at < now() - interval '90 days';
  WITH ev AS (SELECT * FROM public.behaviour_events WHERE occurred_at >= since),
  pv AS (SELECT page_view_id, session_id, path, device, min(occurred_at) AS at FROM ev WHERE event_type='pageview' GROUP BY 1,2,3,4),
  per_view AS (
    SELECT pv.page_view_id, pv.path, pv.session_id,
      max(e.value) FILTER (WHERE e.event_type='scroll') AS scroll,
      max(e.value) FILTER (WHERE e.event_type='leave') AS ms,
      count(*) FILTER (WHERE e.event_type='click') AS clicks,
      count(*) FILTER (WHERE e.event_type='rage_click') AS rage,
      count(*) FILTER (WHERE e.event_type='dead_click') AS dead,
      count(*) FILTER (WHERE e.event_type='form_abandon') AS abandons,
      count(*) FILTER (WHERE e.event_type='form_submit') AS submits
    FROM pv LEFT JOIN ev e ON e.page_view_id = pv.page_view_id GROUP BY 1,2,3),
  seq AS (SELECT session_id, path, row_number() OVER (PARTITION BY session_id ORDER BY at) AS n, count(*) OVER (PARTITION BY session_id) AS total FROM pv)
  SELECT jsonb_build_object(
    'days', least(greatest(p_days,1),90),
    'totals', (SELECT jsonb_build_object('visits', count(DISTINCT session_id), 'page_views', count(*)) FROM pv),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object('device', device, 'visits', c) ORDER BY c DESC) FROM (SELECT device, count(DISTINCT session_id) c FROM pv GROUP BY 1) d), '[]'),
    'pages', COALESCE((SELECT jsonb_agg(p ORDER BY (p->>'views')::int DESC) FROM (
       SELECT jsonb_build_object('path', path, 'views', count(*),
         'avg_scroll', round(avg(scroll)::numeric,0), 'avg_seconds', round((avg(ms)/1000)::numeric,0),
         'clicks', sum(clicks), 'rage_clicks', sum(rage), 'dead_clicks', sum(dead),
         'form_abandons', sum(abandons), 'form_submits', sum(submits),
         'no_click_share', round(100.0*count(*) FILTER (WHERE clicks=0)/count(*),0),
         'exits', (SELECT count(*) FROM seq s WHERE s.path=pv2.path AND s.n=s.total),
         'entries', (SELECT count(*) FROM seq s WHERE s.path=pv2.path AND s.n=1)) p
       FROM per_view pv2 GROUP BY path) x), '[]'),
    'elements', COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'element',element,'clicks',c,'rage',r,'dead',d) ORDER BY c DESC) FROM (
       SELECT path, element, count(*) FILTER (WHERE event_type='click') c, count(*) FILTER (WHERE event_type='rage_click') r, count(*) FILTER (WHERE event_type='dead_click') d
       FROM ev WHERE event_type IN ('click','rage_click','dead_click') AND element IS NOT NULL GROUP BY 1,2 ORDER BY 3 DESC LIMIT 40) y), '[]'),
    'journeys', COALESCE((SELECT jsonb_agg(jsonb_build_object('steps', steps, 'visits', c) ORDER BY c DESC) FROM (
       SELECT steps, count(*) c FROM (SELECT session_id, string_agg(path, ' → ' ORDER BY n) AS steps FROM seq WHERE n <= 4 GROUP BY 1) j GROUP BY 1 ORDER BY 2 DESC LIMIT 10) z), '[]')
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_behaviour_summary(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_behaviour_summary(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_behaviour_heatmap(p_path text, p_days integer DEFAULT 30, p_device text DEFAULT 'desktop')
RETURNS TABLE(event_type text, x real, y real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
  RETURN QUERY SELECT e.event_type, e.x, e.y FROM public.behaviour_events e
   WHERE e.path = p_path AND e.device = p_device AND e.event_type IN ('click','rage_click','dead_click','move')
     AND e.x IS NOT NULL AND e.y IS NOT NULL
     AND e.occurred_at >= now() - make_interval(days => least(greatest(p_days,1),90))
   ORDER BY e.occurred_at DESC LIMIT 5000;
END $$;
REVOKE ALL ON FUNCTION public.admin_behaviour_heatmap(text, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_behaviour_heatmap(text, integer, text) TO authenticated;