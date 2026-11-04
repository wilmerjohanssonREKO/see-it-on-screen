CREATE OR REPLACE FUNCTION public.create_and_publish_assignment(p_subject text, p_date date, p_start time without time zone, p_end time without time zone, p_compensation text, p_description text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid := public.my_school_id(); v_id uuid; v_count integer;
BEGIN
  IF v_school IS NULL THEN RAISE EXCEPTION 'Endast skolkonton kan publicera'; END IF;
  IF p_date IS NULL OR p_date < (now() AT TIME ZONE 'Europe/Stockholm')::date THEN RAISE EXCEPTION 'Datumet har redan passerat'; END IF;
  IF p_end <= p_start THEN RAISE EXCEPTION 'Sluttiden måste vara efter starttiden'; END IF;
  INSERT INTO public.assignments (school_id, subject, assignment_date, start_time, end_time, compensation, description, created_by, published_at)
  VALUES (v_school, p_subject, p_date, p_start, p_end, left(nullif(trim(p_compensation),''),120), left(nullif(trim(p_description),''),1000), auth.uid(), now())
  RETURNING id INTO v_id;
  v_count := public.notify_matching(v_id);
  RETURN v_count;
END $$;