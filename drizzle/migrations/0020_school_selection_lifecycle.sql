-- School selection replaces immediate first-come allocation. Existing bookings
-- and their history are preserved; every new write uses guarded RPCs.
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

CREATE TABLE public.assignment_applications (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','selected','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id,substitute_id)
);
CREATE TABLE public.cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  requester_kind text NOT NULL CHECK (requester_kind IN ('school','substitute')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE UNIQUE INDEX cancellation_one_pending_request ON public.cancellation_requests(assignment_id,requester_id) WHERE status='pending';
CREATE INDEX applications_substitute_status_idx ON public.assignment_applications(substitute_id,status);
CREATE INDEX applications_assignment_status_idx ON public.assignment_applications(assignment_id,status,created_at);
CREATE INDEX cancellation_assignment_status_idx ON public.cancellation_requests(assignment_id,status,created_at DESC);
CREATE INDEX cancellation_pending_idx ON public.cancellation_requests(created_at) WHERE status='pending';
CREATE INDEX assignments_school_date_idx ON public.assignments(school_id,assignment_date DESC,start_time DESC);
CREATE INDEX assignments_open_date_idx ON public.assignments(assignment_date,start_time) WHERE status='open';
CREATE INDEX assignments_substitute_date_idx ON public.assignments(assigned_substitute_id,assignment_date,start_time) WHERE assigned_substitute_id IS NOT NULL;
CREATE INDEX ratings_substitute_idx ON public.ratings(substitute_id);
CREATE INDEX ratings_assignment_idx ON public.ratings(assignment_id);
CREATE INDEX school_ratings_school_idx ON public.school_ratings(school_id);
CREATE INDEX event_log_assignment_type_time_idx ON public.event_log(assignment_id,event_type,occurred_at);
CREATE INDEX event_log_time_idx ON public.event_log(occurred_at DESC);
CREATE INDEX notifications_substitute_idx ON public.notifications(substitute_id);
CREATE INDEX teacher_attempts_email_time_idx ON public.teacher_code_attempts(email,created_at DESC);
CREATE INDEX teacher_attempts_ip_time_idx ON public.teacher_code_attempts(ip,created_at DESC);

ALTER TABLE public.assignment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_applications,public.cancellation_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.assignment_applications,public.cancellation_requests TO authenticated;
GRANT ALL ON public.assignment_applications,public.cancellation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.profile_active(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user AND deactivated_at IS NULL)
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.profile_active(auth.uid()) AND public.has_role(auth.uid(),'admin')
$$;
CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.school_id FROM public.school_members m WHERE m.user_id=auth.uid() AND public.profile_active(auth.uid()) LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.can_manage_school(p_school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.profile_active(auth.uid()) AND (COALESCE(public.is_admin(),false) OR p_school=public.my_school_id())
$$;
CREATE OR REPLACE FUNCTION public.protect_profile_deactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.deactivated_at IS NOT NULL)
 OR (TG_OP='UPDATE' AND NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at) THEN
  IF NOT COALESCE(public.is_admin(),false) AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
     AND current_setting('role',true) IS DISTINCT FROM 'service_role'
     AND NOT (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin') AND coalesce(current_setting('role',true),'none') IN ('none','postgres','supabase_admin')) THEN
   RAISE EXCEPTION 'Endast admin kan inaktivera konton';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_deactivation BEFORE INSERT OR UPDATE OF deactivated_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_deactivation();

CREATE POLICY applications_read ON public.assignment_applications FOR SELECT TO authenticated USING (
 public.profile_active(auth.uid()) AND (substitute_id=auth.uid() OR public.is_admin() OR EXISTS(
 SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.can_manage_school(a.school_id) AND public.same_sandbox(substitute_id,a.school_id)))
);
CREATE POLICY cancellation_read ON public.cancellation_requests FOR SELECT TO authenticated USING (
 public.profile_active(auth.uid()) AND (requester_id=auth.uid() OR public.is_admin() OR EXISTS(
 SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND (public.can_manage_school(a.school_id) OR a.assigned_substitute_id=auth.uid())))
);
-- The previous NOT EXISTS policy could not see decline rows under RLS.
DROP POLICY IF EXISTS assignment_declines_read_own ON public.assignment_declines;
CREATE POLICY assignment_declines_read_own ON public.assignment_declines FOR SELECT TO authenticated USING (substitute_id=auth.uid() OR public.is_admin());
GRANT SELECT ON public.assignment_declines TO authenticated;

CREATE OR REPLACE FUNCTION public.assignment_visible_to_substitute(p_assignment uuid,p_substitute uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.assignments a JOIN public.profiles p ON p.id=p_substitute
 WHERE a.id=p_assignment AND p.approved AND p.background_status='approved' AND p.deactivated_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.school_members m WHERE m.user_id=p_substitute)
 AND public.same_sandbox(p_substitute,a.school_id)
 AND ((a.status='filled' AND a.assigned_substitute_id=p_substitute) OR
 (a.status='open' AND ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')>now()
 AND NOT EXISTS(SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id=a.id AND d.substitute_id=p_substitute))))
$$;
DROP POLICY IF EXISTS assignments_select_notified ON public.assignments;
CREATE POLICY assignments_select_notified ON public.assignments FOR SELECT TO authenticated USING (public.assignment_visible_to_substitute(id,auth.uid()));

CREATE OR REPLACE FUNCTION public.can_view_substitute(p_substitute uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.profile_active(auth.uid()) AND (p_substitute=auth.uid() OR COALESCE(public.is_admin(),false)
 OR EXISTS(SELECT 1 FROM public.assignments a WHERE public.can_manage_school(a.school_id)
 AND public.same_sandbox(p_substitute,a.school_id) AND (
 (a.status='filled' AND a.assigned_substitute_id=p_substitute AND ((a.assignment_date+a.end_time) AT TIME ZONE 'Europe/Stockholm')>now())
 OR (a.status='open' AND ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')>now()
 AND EXISTS(SELECT 1 FROM public.assignment_applications ap WHERE ap.assignment_id=a.id AND ap.substitute_id=p_substitute AND ap.status='pending')))))
$$;

-- Per-profile locks serialize assignment decisions across different schools.
-- Keep this check in a trigger as well as selection RPC so direct admin writes
-- cannot accidentally create conflicting future allocations.
CREATE OR REPLACE FUNCTION public.guard_assignment_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='filled' AND public.assignment_completed(OLD.id) AND (NEW.status IS DISTINCT FROM OLD.status
    OR ROW(NEW.assignment_date,NEW.start_time,NEW.end_time,NEW.school_id) IS DISTINCT FROM ROW(OLD.assignment_date,OLD.start_time,OLD.end_time,OLD.school_id)) THEN
   RAISE EXCEPTION 'Genomförda uppdrag får inte öppnas igen eller avbokas';
  END IF;
 END IF;
 IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status
 OR ROW(OLD.assignment_date,OLD.start_time,OLD.end_time,OLD.school_id) IS DISTINCT FROM ROW(NEW.assignment_date,NEW.start_time,NEW.end_time,NEW.school_id))
 AND ((NEW.assignment_date+NEW.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Starttiden har redan passerat'; END IF;
 IF NEW.status='open' THEN NEW.assigned_substitute_id:=NULL; NEW.assigned_at:=NULL; END IF;
 IF NEW.status='filled' AND NEW.assigned_substitute_id IS NULL AND (TG_OP='INSERT' OR OLD.status<>'filled') THEN RAISE EXCEPTION 'Välj en vikarie innan uppdraget tillsätts'; END IF;
 IF NEW.status='filled' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_substitute_id IS DISTINCT FROM NEW.assigned_substitute_id
 OR ROW(OLD.assignment_date,OLD.start_time,OLD.end_time,OLD.school_id) IS DISTINCT FROM ROW(NEW.assignment_date,NEW.start_time,NEW.end_time,NEW.school_id))
 AND NEW.assigned_substitute_id IS NOT NULL THEN
  IF ((NEW.assignment_date+NEW.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Uppdraget har redan börjat'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=NEW.assigned_substitute_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.assigned_substitute_id AND approved AND background_status='approved' AND deactivated_at IS NULL)
     OR NOT public.same_sandbox(NEW.assigned_substitute_id,NEW.school_id)
     OR EXISTS(SELECT 1 FROM public.school_members WHERE user_id=NEW.assigned_substitute_id) THEN RAISE EXCEPTION 'Vikarien är inte tillgänglig'; END IF;
  IF EXISTS(SELECT 1 FROM public.assignments a WHERE a.id<>NEW.id AND a.assigned_substitute_id=NEW.assigned_substitute_id AND a.status='filled'
    AND a.assignment_date=NEW.assignment_date AND a.start_time<NEW.end_time AND a.end_time>NEW.start_time) THEN RAISE EXCEPTION 'Vikarien har ett överlappande uppdrag'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignments_guard_lifecycle BEFORE INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_lifecycle();

CREATE OR REPLACE FUNCTION public.apply_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE; v_status text;
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
 PERFORM public.log_event('application_submitted',p_assignment_id,v_a.school_id,auth.uid());
 RETURN 'applied';
END $$;
-- Old clients can no longer allocate themselves a job.
CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.apply_assignment(p_assignment_id) $$;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Kontot är inte aktivt'; END IF;
 PERFORM 1 FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 UPDATE public.assignment_applications SET status='withdrawn',updated_at=now() WHERE assignment_id=p_assignment_id AND substitute_id=auth.uid() AND status='pending';
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.select_applicant(p_assignment_id uuid,p_substitute_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE;
BEGIN
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR NOT COALESCE(public.can_manage_school(v_a.school_id),false) THEN RAISE EXCEPTION 'Du får inte välja vikarie för detta uppdrag'; END IF;
 IF v_a.status<>'open' OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RETURN 'unavailable'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_substitute_id FOR UPDATE;
 IF NOT public.assignment_visible_to_substitute(p_assignment_id,p_substitute_id)
 OR NOT EXISTS(SELECT 1 FROM public.assignment_applications WHERE assignment_id=p_assignment_id AND substitute_id=p_substitute_id AND status='pending') THEN RETURN 'not_approved'; END IF;
 IF EXISTS(SELECT 1 FROM public.assignments WHERE assigned_substitute_id=p_substitute_id AND status='filled' AND assignment_date=v_a.assignment_date AND start_time<v_a.end_time AND end_time>v_a.start_time) THEN RETURN 'overlap'; END IF;
 UPDATE public.assignments SET status='filled',assigned_substitute_id=p_substitute_id,assigned_at=now(),cancelled_at=NULL WHERE id=p_assignment_id;
 UPDATE public.assignment_applications SET status='selected',updated_at=now() WHERE assignment_id=p_assignment_id AND substitute_id=p_substitute_id;
 PERFORM public.log_event('substitute_accepted',p_assignment_id,v_a.school_id,p_substitute_id);
 RETURN 'selected';
END $$;
CREATE OR REPLACE FUNCTION public.reject_applicant(p_assignment_id uuid,p_substitute_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE;
BEGIN
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR NOT COALESCE(public.can_manage_school(v_a.school_id),false) THEN RAISE EXCEPTION 'Du får inte ändra detta uppdrag'; END IF;
 IF v_a.status<>'open' OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RETURN false; END IF;
 UPDATE public.assignment_applications SET status='rejected',updated_at=now() WHERE assignment_id=p_assignment_id AND substitute_id=p_substitute_id AND status='pending';
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.assignment_declines(assignment_id,substitute_id) VALUES(p_assignment_id,p_substitute_id) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.school_applicants(p_assignment_id uuid)
RETURNS TABLE(substitute_id uuid,full_name text,phone text,subjects text[],has_cv boolean,status text,created_at timestamptz,rating_avg numeric,rating_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid;
BEGIN
 SELECT school_id INTO v_school FROM public.assignments WHERE id=p_assignment_id;
 IF NOT COALESCE(public.can_manage_school(v_school),false) THEN RAISE EXCEPTION 'Du får inte se sökande för detta uppdrag'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.phone,p.subjects,(p.cv_file_path IS NOT NULL AND p.cv_consent_at IS NOT NULL),ap.status,ap.created_at,
 (SELECT round(avg(r.score),1) FROM public.ratings r WHERE r.substitute_id=p.id),(SELECT count(*)::int FROM public.ratings r WHERE r.substitute_id=p.id)
 FROM public.assignment_applications ap JOIN public.profiles p ON p.id=ap.substitute_id
 WHERE ap.assignment_id=p_assignment_id AND public.same_sandbox(p.id,v_school) AND p.deactivated_at IS NULL ORDER BY ap.created_at,p.id;
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
 INSERT INTO public.cancellation_requests(assignment_id,requester_id,requester_kind,reason) VALUES(p_assignment_id,auth.uid(),v_kind,btrim(p_reason))
 ON CONFLICT(assignment_id,requester_id) WHERE status='pending' DO UPDATE SET reason=EXCLUDED.reason RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.my_cancellation_requests()
RETURNS TABLE(id uuid,assignment_id uuid,status text,reason text,requester_kind text,created_at timestamptz,subject text,assignment_date date,school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.assignment_id,c.status,c.reason,c.requester_kind,c.created_at,a.subject,a.assignment_date,s.name FROM public.cancellation_requests c
 JOIN public.assignments a ON a.id=c.assignment_id JOIN public.schools s ON s.id=a.school_id WHERE public.profile_active(auth.uid()) AND (c.requester_id=auth.uid() OR public.can_manage_school(a.school_id) OR a.assigned_substitute_id=auth.uid()
 OR EXISTS(SELECT 1 FROM public.assignment_applications ap WHERE ap.assignment_id=a.id AND ap.substitute_id=auth.uid() AND ap.status='withdrawn' AND c.status='approved'))
 ORDER BY c.created_at DESC LIMIT 500
$$;
CREATE OR REPLACE FUNCTION public.admin_cancellation_requests(p_limit integer DEFAULT 25,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,assignment_id uuid,school_name text,subject text,assignment_date date,requester_name text,reason text,status text,requester_kind text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT c.id,c.assignment_id,s.name,a.subject,a.assignment_date,coalesce(p.full_name,'Borttaget konto'),c.reason,c.status,c.requester_kind,c.created_at
 FROM public.cancellation_requests c JOIN public.assignments a ON a.id=c.assignment_id JOIN public.schools s ON s.id=a.school_id LEFT JOIN public.profiles p ON p.id=c.requester_id
 ORDER BY (c.status='pending') DESC,c.created_at DESC,c.id LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(0,coalesce(p_offset,0));
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
CREATE OR REPLACE FUNCTION public.admin_reopen_assignment(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Endast framtida uppdrag får öppnas igen'; END IF;
 UPDATE public.assignments SET status='open',assigned_substitute_id=NULL,assigned_at=NULL,cancelled_at=NULL WHERE id=p_assignment_id;
 UPDATE public.assignment_applications SET status='withdrawn',updated_at=now() WHERE assignment_id=p_assignment_id AND status='selected';
 UPDATE public.cancellation_requests SET status='denied',resolved_at=now(),resolved_by=auth.uid() WHERE assignment_id=p_assignment_id AND status='pending';
 PERFORM public.notify_matching(p_assignment_id);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.admin_expire_assignment(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR public.assignment_completed(p_assignment_id) THEN RAISE EXCEPTION 'Genomförda uppdrag får inte avbokas'; END IF;
 UPDATE public.assignments SET status='expired',assigned_substitute_id=NULL,assigned_at=NULL,cancelled_at=now() WHERE id=p_assignment_id;
 UPDATE public.assignment_applications SET status='withdrawn',updated_at=now() WHERE assignment_id=p_assignment_id AND status IN ('pending','selected');
 RETURN true;
END $$;
-- An allocated substitute is no longer rejected immediately by a school.
CREATE OR REPLACE FUNCTION public.decline_substitute(p_assignment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.request_assignment_cancellation(p_assignment_id,'Skolan vill avboka tilldelad vikarie');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.create_and_publish_assignment(p_subject text,p_date date,p_start time,p_end time,p_compensation text,p_description text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid:=public.my_school_id(); v_id uuid;
BEGIN
 IF v_school IS NULL OR NOT public.can_manage_school(v_school) THEN RAISE EXCEPTION 'Endast skolkonton kan publicera'; END IF;
 IF p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Ange ett ämne'; END IF;
 IF p_date IS NULL OR p_start IS NULL OR p_end IS NULL OR ((p_date+p_start) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Starttiden har redan passerat'; END IF;
 IF p_end<=p_start THEN RAISE EXCEPTION 'Sluttiden måste vara efter starttiden'; END IF;
 INSERT INTO public.assignments(school_id,subject,assignment_date,start_time,end_time,compensation,description,created_by,published_at)
 VALUES(v_school,btrim(p_subject),p_date,p_start,p_end,left(nullif(btrim(p_compensation),''),120),left(nullif(btrim(p_description),''),1000),auth.uid(),now()) RETURNING id INTO v_id;
 RETURN public.notify_matching(v_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_and_publish_assignment(p_school_id uuid,p_subject text,p_date date,p_start time,p_end time,p_compensation text,p_description text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=p_school_id) THEN RAISE EXCEPTION 'Skolan finns inte'; END IF;
 IF p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Ange ett ämne'; END IF;
 IF p_date IS NULL OR p_start IS NULL OR p_end IS NULL OR ((p_date+p_start) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Starttiden har redan passerat'; END IF;
 IF p_end<=p_start THEN RAISE EXCEPTION 'Sluttiden måste vara efter starttiden'; END IF;
 INSERT INTO public.assignments(school_id,subject,assignment_date,start_time,end_time,compensation,description,created_by,published_at)
 VALUES(p_school_id,btrim(p_subject),p_date,p_start,p_end,left(nullif(btrim(p_compensation),''),120),left(nullif(btrim(p_description),''),1000),auth.uid(),now()) RETURNING id INTO v_id;
 RETURN public.notify_matching(v_id);
END $$;
CREATE OR REPLACE FUNCTION public.notify_matching(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid; v_count integer;
BEGIN
 SELECT school_id INTO v_school FROM public.assignments WHERE id=p_assignment_id AND status='open' AND ((assignment_date+start_time) AT TIME ZONE 'Europe/Stockholm')>now();
 IF v_school IS NULL THEN RETURN 0; END IF;
 INSERT INTO public.notifications(assignment_id,substitute_id)
 SELECT p_assignment_id,p.id FROM public.profiles p WHERE p.approved AND p.background_status='approved' AND p.deactivated_at IS NULL
 AND public.same_sandbox(p.id,v_school) AND NOT EXISTS(SELECT 1 FROM public.school_members m WHERE m.user_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.assignment_declines d WHERE d.assignment_id=p_assignment_id AND d.substitute_id=p.id) ON CONFLICT DO NOTHING;
 SELECT count(*)::int INTO v_count FROM public.notifications WHERE assignment_id=p_assignment_id;
 RETURN v_count;
END $$;
CREATE OR REPLACE FUNCTION public.publish_assignment(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.assignments%ROWTYPE;
BEGIN
 SELECT * INTO v_a FROM public.assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR NOT COALESCE(public.can_manage_school(v_a.school_id),false) THEN RAISE EXCEPTION 'Du får inte publicera detta uppdrag'; END IF;
 IF v_a.status<>'open' OR ((v_a.assignment_date+v_a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RAISE EXCEPTION 'Endast framtida öppna uppdrag kan publiceras'; END IF;
 UPDATE public.assignments SET published_at=coalesce(published_at,now()) WHERE id=p_assignment_id;
 RETURN public.notify_matching(p_assignment_id);
END $$;

CREATE OR REPLACE FUNCTION public.log_assignment_view(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid;
BEGIN
 IF NOT public.assignment_visible_to_substitute(p_assignment_id,auth.uid()) THEN RETURN; END IF;
 SELECT school_id INTO v_school FROM public.assignments WHERE id=p_assignment_id;
 INSERT INTO public.notifications(assignment_id,substitute_id) VALUES(p_assignment_id,auth.uid()) ON CONFLICT DO NOTHING;
 UPDATE public.notifications SET first_viewed_at=now() WHERE assignment_id=p_assignment_id AND substitute_id=auth.uid() AND first_viewed_at IS NULL;
 IF FOUND THEN PERFORM public.log_event('notification_viewed',p_assignment_id,v_school,auth.uid()); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.school_assignments_page(p_limit integer DEFAULT 25,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,subject text,assignment_date date,start_time time,end_time time,description text,compensation text,status assignment_status,substitute_id uuid,substitute_name text,substitute_phone text,substitute_rating_avg numeric,substitute_rating_count integer,completed boolean,rated boolean,created_at timestamptz,applicant_count integer,cancellation_status text,has_cv boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH jobs AS (SELECT a.* FROM public.assignments a WHERE a.school_id=public.my_school_id()
 ORDER BY a.assignment_date DESC,a.start_time DESC,a.id LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(0,coalesce(p_offset,0))),
 scores AS (SELECT r.substitute_id,round(avg(r.score),1) avg_score,count(*)::int rating_count FROM public.ratings r WHERE r.substitute_id IN (SELECT assigned_substitute_id FROM jobs) GROUP BY r.substitute_id)
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,p.id,p.full_name,p.phone,sc.avg_score,coalesce(sc.rating_count,0),public.assignment_completed(a.id),
 EXISTS(SELECT 1 FROM public.ratings r WHERE r.assignment_id=a.id),a.created_at,
 (SELECT count(*)::int FROM public.assignment_applications ap WHERE ap.assignment_id=a.id AND ap.status='pending'),
 (SELECT c.status FROM public.cancellation_requests c WHERE c.assignment_id=a.id ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 1),
 (p.cv_file_path IS NOT NULL AND p.cv_consent_at IS NOT NULL AND public.can_view_substitute(p.id))
 FROM jobs a LEFT JOIN public.profiles p ON p.id=a.assigned_substitute_id AND public.same_sandbox(p.id,a.school_id) LEFT JOIN scores sc ON sc.substitute_id=p.id
 ORDER BY a.assignment_date DESC,a.start_time DESC,a.id
$$;
CREATE OR REPLACE FUNCTION public.substitute_assignments_page(p_limit integer DEFAULT 25,p_offset integer DEFAULT 0,p_date date DEFAULT NULL,p_subject text DEFAULT NULL)
RETURNS TABLE(id uuid,subject text,assignment_date date,start_time time,end_time time,description text,compensation text,status assignment_status,assigned_to_me boolean,school_name text,school_contact_person text,school_phone text,school_email text,school_rating_avg numeric,school_rating_count integer,completed boolean,rated boolean,application_status text,cancellation_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH jobs AS (SELECT a.* FROM public.assignments a WHERE public.assignment_visible_to_substitute(a.id,auth.uid())
 AND (p_date IS NULL OR a.assignment_date=p_date) AND (p_subject IS NULL OR a.subject=p_subject)
 ORDER BY a.assignment_date,a.start_time,a.id LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(0,coalesce(p_offset,0))),
 scores AS (SELECT r.school_id,round(avg(r.score),1) avg_score,count(*)::int rating_count FROM public.school_ratings r WHERE r.school_id IN(SELECT school_id FROM jobs) GROUP BY r.school_id)
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,coalesce(a.assigned_substitute_id=auth.uid(),false),s.name,
 CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.contact_person END,CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.phone END,CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.email END,
 sc.avg_score,coalesce(sc.rating_count,0),public.assignment_completed(a.id),EXISTS(SELECT 1 FROM public.school_ratings r WHERE r.assignment_id=a.id),ap.status,
 (SELECT c.status FROM public.cancellation_requests c WHERE c.assignment_id=a.id AND (c.requester_id=auth.uid() OR a.assigned_substitute_id=auth.uid()) ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 1)
 FROM jobs a JOIN public.schools s ON s.id=a.school_id LEFT JOIN scores sc ON sc.school_id=s.id LEFT JOIN public.assignment_applications ap ON ap.assignment_id=a.id AND ap.substitute_id=auth.uid()
 ORDER BY a.assignment_date,a.start_time,a.id
$$;

CREATE OR REPLACE FUNCTION public.admin_assignments_page(p_limit integer DEFAULT 25,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,school_id uuid,subject text,assignment_date date,start_time time,end_time time,status assignment_status,description text,compensation text,assigned_substitute_id uuid,school_name text,school_email text,school_phone text,school_contact_person text,substitute_name text,substitute_email text,substitute_phone text,notified_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY WITH jobs AS(SELECT a.* FROM public.assignments a ORDER BY a.assignment_date DESC,a.start_time DESC,a.id
 LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(0,coalesce(p_offset,0)))
 SELECT a.id,a.school_id,a.subject,a.assignment_date,a.start_time,a.end_time,a.status,a.description,a.compensation,a.assigned_substitute_id,s.name,s.email,s.phone,s.contact_person,p.full_name,p.email,p.phone,
 (SELECT count(*)::int FROM public.notifications n WHERE n.assignment_id=a.id)
 FROM jobs a JOIN public.schools s ON s.id=a.school_id LEFT JOIN public.profiles p ON p.id=a.assigned_substitute_id
 ORDER BY a.assignment_date DESC,a.start_time DESC,a.id;
END $$;
-- Compatibility endpoints keep their original shape; updated clients use pages.
CREATE OR REPLACE FUNCTION public.school_assignments()
RETURNS TABLE(id uuid,subject text,assignment_date date,start_time time,end_time time,description text,compensation text,status assignment_status,substitute_id uuid,substitute_name text,substitute_phone text,substitute_rating_avg numeric,substitute_rating_count integer,completed boolean,rated boolean,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,a.substitute_id,a.substitute_name,a.substitute_phone,a.substitute_rating_avg,a.substitute_rating_count,a.completed,a.rated,a.created_at FROM public.school_assignments_page(100,0) a
$$;
CREATE OR REPLACE FUNCTION public.substitute_assignments()
RETURNS TABLE(id uuid,subject text,assignment_date date,start_time time,end_time time,description text,compensation text,status assignment_status,assigned_to_me boolean,school_name text,school_contact_person text,school_phone text,school_email text,school_rating_avg numeric,school_rating_count integer,completed boolean,rated boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,a.assigned_to_me,a.school_name,a.school_contact_person,a.school_phone,a.school_email,a.school_rating_avg,a.school_rating_count,a.completed,a.rated FROM public.substitute_assignments_page(100,0) a
$$;

CREATE OR REPLACE FUNCTION public.admin_event_log_page(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,occurred_at timestamptz,event_type text,assignment_id uuid,school_id uuid,substitute_ref text,metadata jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT e.id,e.occurred_at,e.event_type,e.assignment_id,e.school_id,e.substitute_ref,e.metadata FROM public.event_log e
 ORDER BY e.occurred_at DESC,e.id LIMIT greatest(1,least(coalesce(p_limit,100),500)) OFFSET greatest(0,coalesce(p_offset,0));
END $$;
CREATE OR REPLACE FUNCTION public.admin_assignment_metrics_page(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF public.assignment_metrics LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT * FROM public.assignment_metrics ORDER BY created_at DESC,assignment_id LIMIT greatest(1,least(coalesce(p_limit,100),500)) OFFSET greatest(0,coalesce(p_offset,0));
END $$;

-- Public SQL privileges are not a substitute for RLS; remove unnecessary
-- high-impact privileges while preserving normal RLS-protected API operations.
DO $$ DECLARE v_table record; BEGIN
 FOR v_table IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated',v_table.tablename);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.profile_active(uuid),public.my_school_id(),public.can_manage_school(uuid),public.assignment_visible_to_substitute(uuid,uuid),public.can_view_substitute(uuid),public.apply_assignment(uuid),public.claim_assignment(uuid),public.withdraw_application(uuid),public.select_applicant(uuid,uuid),public.reject_applicant(uuid,uuid),public.school_applicants(uuid),public.request_assignment_cancellation(uuid,text),public.my_cancellation_requests(),public.admin_cancellation_requests(integer,integer),public.admin_resolve_cancellation(uuid,boolean),public.admin_reopen_assignment(uuid),public.admin_expire_assignment(uuid),public.decline_substitute(uuid),public.create_and_publish_assignment(text,date,time,time,text,text),public.log_assignment_view(uuid),public.school_assignments_page(integer,integer),public.substitute_assignments_page(integer,integer,date,text),public.admin_event_log_page(integer,integer),public.admin_assignment_metrics_page(integer,integer),public.admin_assignments_page(integer,integer),public.admin_create_and_publish_assignment(uuid,text,date,time,time,text,text),public.publish_assignment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.profile_active(uuid),public.my_school_id(),public.can_manage_school(uuid),public.assignment_visible_to_substitute(uuid,uuid),public.can_view_substitute(uuid),public.apply_assignment(uuid),public.claim_assignment(uuid),public.withdraw_application(uuid),public.select_applicant(uuid,uuid),public.reject_applicant(uuid,uuid),public.school_applicants(uuid),public.request_assignment_cancellation(uuid,text),public.my_cancellation_requests(),public.admin_cancellation_requests(integer,integer),public.admin_resolve_cancellation(uuid,boolean),public.admin_reopen_assignment(uuid),public.admin_expire_assignment(uuid),public.decline_substitute(uuid),public.create_and_publish_assignment(text,date,time,time,text,text),public.log_assignment_view(uuid),public.school_assignments_page(integer,integer),public.substitute_assignments_page(integer,integer,date,text),public.admin_event_log_page(integer,integer),public.admin_assignment_metrics_page(integer,integer),public.admin_assignments_page(integer,integer),public.admin_create_and_publish_assignment(uuid,text,date,time,time,text,text),public.publish_assignment(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.guard_assignment_lifecycle(),public.protect_profile_deactivation() FROM PUBLIC,anon,authenticated;
