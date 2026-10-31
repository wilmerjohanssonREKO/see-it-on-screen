CREATE OR REPLACE FUNCTION public.same_sandbox(p_substitute uuid, p_school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles p JOIN public.schools s ON s.id=p_school WHERE p.id=p_substitute AND p.is_test=s.is_test)
$$;
CREATE OR REPLACE FUNCTION public.protect_is_test()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.is_test AND NOT COALESCE(public.is_admin(),false) THEN NEW.is_test:=false; END IF;
 ELSIF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
  IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin kan ändra testläge'; END IF;
  IF TG_TABLE_NAME='schools' AND EXISTS(SELECT 1 FROM public.assignments WHERE school_id=OLD.id) THEN
   RAISE EXCEPTION 'Skolan har uppdrag. Skapa ett separat testkonto i stället för att byta läge.';
  ELSIF TG_TABLE_NAME='profiles' AND (EXISTS(SELECT 1 FROM public.assignments WHERE assigned_substitute_id=OLD.id) OR EXISTS(SELECT 1 FROM public.assignment_declines WHERE substitute_id=OLD.id) OR EXISTS(SELECT 1 FROM public.school_members WHERE user_id=OLD.id)) THEN
   RAISE EXCEPTION 'Kontot har skolkoppling eller uppdragshistorik. Skapa ett separat testkonto i stället för att byta läge.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.can_view_substitute(p_substitute uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p_substitute=auth.uid() OR COALESCE(public.is_admin(),false)
 OR (public.my_school_id() IS NOT NULL AND public.same_sandbox(p_substitute,public.my_school_id()) AND (
 EXISTS(SELECT 1 FROM public.assignments a WHERE a.school_id=public.my_school_id() AND a.assigned_substitute_id=p_substitute)
 OR EXISTS(SELECT 1 FROM public.assignment_declines d JOIN public.assignments a ON a.id=d.assignment_id WHERE a.school_id=public.my_school_id() AND d.substitute_id=p_substitute)))
$$;
CREATE OR REPLACE FUNCTION public.school_assignments()
RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time without time zone, end_time time without time zone, description text, compensation text, status assignment_status, substitute_id uuid, substitute_name text, substitute_phone text, substitute_rating_avg numeric, substitute_rating_count integer, completed boolean, rated boolean, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,p.id,p.full_name,p.phone,
 (SELECT round(avg(r.score),1) FROM public.ratings r WHERE r.substitute_id=p.id),
 (SELECT count(*)::int FROM public.ratings r WHERE r.substitute_id=p.id), public.assignment_completed(a.id),
 EXISTS(SELECT 1 FROM public.ratings r WHERE r.assignment_id=a.id),a.created_at
 FROM public.assignments a LEFT JOIN public.profiles p ON p.id=a.assigned_substitute_id AND public.same_sandbox(p.id,a.school_id)
 WHERE a.school_id=public.my_school_id() ORDER BY a.assignment_date DESC,a.start_time DESC
$$;
CREATE OR REPLACE FUNCTION public.log_assignment_view(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.substitute_assignments() a WHERE a.id=p_assignment_id) THEN
  PERFORM public.log_event('notification_viewed',p_assignment_id,NULL,auth.uid());
 END IF;
END $$;
DROP POLICY IF EXISTS notifications_select_own_or_admin ON public.notifications;
CREATE POLICY notifications_select_own_or_admin ON public.notifications FOR SELECT TO authenticated USING (
 public.is_admin() OR (substitute_id=auth.uid() AND EXISTS(SELECT 1 FROM public.assignments a WHERE a.id=notifications.assignment_id AND public.same_sandbox(auth.uid(),a.school_id)))
);
DROP POLICY IF EXISTS schools_select_related ON public.schools;
CREATE POLICY schools_select_related ON public.schools FOR SELECT TO authenticated USING (
 id=public.my_school_id() OR (public.same_sandbox(auth.uid(),id) AND EXISTS(SELECT 1 FROM public.assignments a WHERE a.school_id=schools.id AND a.assigned_substitute_id=auth.uid()))
);
CREATE OR REPLACE FUNCTION public.purge_sandbox_data()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[]; v_count integer;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 SELECT coalesce(array_agg(a.id),'{}') INTO v_ids FROM public.assignments a JOIN public.schools s ON s.id=a.school_id WHERE s.is_test;
 DELETE FROM public.sandbox_emails WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.notifications WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.assignment_declines WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.ratings WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.school_ratings WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.event_log WHERE assignment_id=ANY(v_ids);
 DELETE FROM public.assignments WHERE id=ANY(v_ids);
 v_count:=coalesce(array_length(v_ids,1),0);
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.same_sandbox(uuid,uuid), public.can_view_substitute(uuid), public.school_assignments(), public.log_assignment_view(uuid), public.purge_sandbox_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.same_sandbox(uuid,uuid), public.can_view_substitute(uuid), public.school_assignments(), public.log_assignment_view(uuid), public.purge_sandbox_data() TO authenticated,service_role;