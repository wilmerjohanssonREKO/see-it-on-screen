-- Regression fixes discovered by expanded local flow tests.
-- Preserve the actual booking party on each cancellation; a withdrawn
-- application does not prove involvement in a later booking/cancellation.
ALTER TABLE public.cancellation_requests ADD COLUMN affected_substitute_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
-- Only pending requests have an authoritative current booking to snapshot.
UPDATE public.cancellation_requests c SET affected_substitute_id=a.assigned_substitute_id
FROM public.assignments a WHERE a.id=c.assignment_id AND c.status='pending' AND c.affected_substitute_id IS NULL;
DROP POLICY cancellation_read ON public.cancellation_requests;
CREATE POLICY cancellation_read ON public.cancellation_requests FOR SELECT TO authenticated USING (
 public.profile_active(auth.uid()) AND (public.is_admin() OR EXISTS(
 SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND (public.can_manage_school(a.school_id)
 OR (public.same_sandbox(auth.uid(),a.school_id) AND (requester_id=auth.uid() OR affected_substitute_id=auth.uid())))))
);
CREATE OR REPLACE FUNCTION public.apply_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE; v_status text; v_changed integer;
BEGIN
 IF NOT public.profile_active(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND approved AND background_status='approved')
 OR EXISTS(SELECT 1 FROM public.school_members WHERE user_id=auth.uid()) THEN RETURN 'not_approved'; END IF;
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR v_a.status<>'open' OR NOT public.assignment_visible_to_substitute(p_assignment_id,auth.uid()) THEN RETURN 'unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.assignments WHERE assigned_substitute_id=auth.uid() AND status='filled' AND assignment_date=v_a.assignment_date AND start_time<v_a.end_time AND end_time>v_a.start_time) THEN RETURN 'overlap'; END IF;
 SELECT status INTO v_status FROM public.assignment_applications WHERE assignment_id=p_assignment_id AND substitute_id=auth.uid();
 IF v_status='rejected' THEN RETURN 'unavailable'; END IF;
 INSERT INTO public.assignment_applications(assignment_id,substitute_id) VALUES(p_assignment_id,auth.uid())
 ON CONFLICT(assignment_id,substitute_id) DO UPDATE SET status='pending',updated_at=now() WHERE assignment_applications.status='withdrawn';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed=1 THEN
  PERFORM public.log_event('application_submitted',p_assignment_id,v_a.school_id,auth.uid());
 END IF;
 RETURN 'applied';
END $$;

CREATE OR REPLACE FUNCTION public.request_assignment_cancellation(p_assignment_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE; v_kind text; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Logga in för att begära avbokning'; END IF;
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;
 IF public.can_manage_school(v_a.school_id) THEN v_kind:='school';
 ELSIF v_a.assigned_substitute_id=auth.uid() AND public.same_sandbox(auth.uid(),v_a.school_id) THEN v_kind:='substitute';
 ELSE RAISE EXCEPTION 'Du får inte avboka detta uppdrag'; END IF;
 IF v_a.status NOT IN ('open','filled') OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Uppdraget har redan börjat eller är avslutat'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Ange en orsak med högst 500 tecken'; END IF;
 INSERT INTO public.cancellation_requests(assignment_id,requester_id,requester_kind,reason,affected_substitute_id) VALUES(p_assignment_id,auth.uid(),v_kind,btrim(p_reason),v_a.assigned_substitute_id)
 ON CONFLICT(assignment_id,requester_id) WHERE status='pending' DO UPDATE SET reason=EXCLUDED.reason,affected_substitute_id=EXCLUDED.affected_substitute_id RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_cancellation(p_request_id uuid,p_approve boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.cancellation_requests%ROWTYPE; v_a public.assignments%ROWTYPE; v_assignment uuid;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 SELECT assignment_id INTO v_assignment FROM public.cancellation_requests WHERE id=p_request_id;
 SELECT * INTO v_a FROM public.assignments WHERE id=v_assignment FOR UPDATE;
 SELECT * INTO v_request FROM public.cancellation_requests WHERE id=p_request_id FOR UPDATE;
 IF v_request.id IS NULL OR v_request.status<>'pending' THEN RETURN false; END IF;
 -- Legacy pending requests gain their participant snapshot only when resolved.
 UPDATE public.cancellation_requests SET affected_substitute_id=COALESCE(affected_substitute_id,v_a.assigned_substitute_id) WHERE id=p_request_id;
 IF p_approve THEN
  IF v_a.status NOT IN ('open','filled') OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Uppdraget kan inte längre avbokas'; END IF;
  IF v_request.requester_kind='substitute' AND v_a.assigned_substitute_id IS DISTINCT FROM v_request.requester_id THEN RAISE EXCEPTION 'Tilldelningen har ändrats; begäran är inte längre giltig'; END IF;
  IF v_request.requester_kind='substitute' THEN
   UPDATE public.assignments SET status='open',assigned_substitute_id=NULL,assigned_at=NULL,cancelled_at=NULL WHERE id=v_a.id;
   UPDATE public.assignment_applications SET status='withdrawn',updated_at=now() WHERE assignment_id=v_a.id AND substitute_id=v_request.requester_id;
   PERFORM public.notify_matching(v_a.id);
  ELSE
   UPDATE public.assignments SET status='expired',assigned_substitute_id=NULL,assigned_at=NULL,cancelled_at=now() WHERE id=v_a.id;
   UPDATE public.assignment_applications SET status='withdrawn',updated_at=now() WHERE assignment_id=v_a.id AND status IN ('pending','selected');
  END IF;
 END IF;
 UPDATE public.cancellation_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'denied' END,resolved_at=now(),resolved_by=auth.uid() WHERE id=p_request_id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.my_cancellation_requests()
RETURNS TABLE(id uuid,assignment_id uuid,status text,reason text,requester_kind text,created_at timestamptz,subject text,assignment_date date,school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.assignment_id,c.status,c.reason,c.requester_kind,c.created_at,a.subject,a.assignment_date,s.name FROM public.cancellation_requests c
 JOIN public.assignments a ON a.id=c.assignment_id JOIN public.schools s ON s.id=a.school_id WHERE public.profile_active(auth.uid()) AND (public.is_admin() OR public.can_manage_school(a.school_id)
 OR (public.same_sandbox(auth.uid(),a.school_id) AND (c.requester_id=auth.uid() OR c.affected_substitute_id=auth.uid())))
 ORDER BY c.created_at DESC LIMIT 500
$$;
-- CREATE OR REPLACE retains existing EXECUTE grants and return shapes.
-- No resolved legacy participant is inferred from application history.
