CREATE OR REPLACE FUNCTION public.log_event(p_event_type text, p_assignment_id uuid DEFAULT NULL, p_school_id uuid DEFAULT NULL, p_substitute_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text; v_ref text;
BEGIN
  IF p_substitute_id IS NOT NULL THEN
    INSERT INTO public.log_config (id, secret) VALUES (true, encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (id) DO NOTHING;
    SELECT secret INTO v_secret FROM public.log_config WHERE id = true;
    v_ref := encode(extensions.hmac(p_substitute_id::text, v_secret, 'sha256'), 'hex');
  END IF;
  INSERT INTO public.event_log (event_type, assignment_id, school_id, substitute_ref, metadata)
  VALUES (p_event_type, p_assignment_id, p_school_id, v_ref, COALESCE(p_metadata, '{}'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.log_event(text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;