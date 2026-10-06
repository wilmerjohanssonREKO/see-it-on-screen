CREATE OR REPLACE FUNCTION public.decline_substitute(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_sub uuid;
BEGIN
  SELECT school_id, assigned_substitute_id INTO v_school, v_sub FROM public.assignments WHERE id = p_assignment_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
  IF NOT (public.is_admin() OR v_school = public.my_school_id()) THEN
    RAISE EXCEPTION 'Du får inte ändra detta uppdrag';
  END IF;
  IF v_sub IS NULL THEN RETURN false; END IF;
  -- The declined substitute loses access to this assignment
  DELETE FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = v_sub;
  UPDATE public.assignments SET status = 'open', assigned_substitute_id = NULL, assigned_at = NULL
  WHERE id = p_assignment_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.decline_substitute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_substitute(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_updated integer; v_ok boolean;
BEGIN
  SELECT (approved AND background_status = 'approved') INTO v_ok FROM public.profiles WHERE id = auth.uid();
  IF v_ok IS NOT TRUE THEN RETURN 'not_approved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE assignment_id = p_assignment_id AND substitute_id = auth.uid()) THEN
    RETURN 'already_filled';
  END IF;
  UPDATE public.assignments
  SET status = 'filled', assigned_substitute_id = auth.uid(), assigned_at = now()
  WHERE id = p_assignment_id AND status = 'open';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN RETURN 'claimed'; ELSE RETURN 'already_filled'; END IF;
END;
$function$;