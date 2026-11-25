CREATE OR REPLACE FUNCTION public.substitute_assignments_page(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date date DEFAULT NULL::date, p_subject text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, subject text, assignment_date date, start_time time without time zone, end_time time without time zone, description text, compensation text, status assignment_status, assigned_to_me boolean, school_name text, school_contact_person text, school_phone text, school_email text, school_rating_avg numeric, school_rating_count integer, completed boolean, rated boolean, application_status text, cancellation_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH jobs AS (SELECT a.* FROM public.assignments a WHERE public.assignment_visible_to_substitute(a.id,auth.uid())
 AND (p_date IS NULL OR a.assignment_date=p_date) AND (p_subject IS NULL OR a.subject=p_subject)
 ORDER BY ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now(),
          CASE WHEN ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')>now()
               THEN (a.assignment_date+a.start_time) END ASC,
          CASE WHEN ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now()
               THEN (a.assignment_date+a.start_time) END DESC,
          a.id
 LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(0,coalesce(p_offset,0))),
 scores AS (SELECT r.school_id,round(avg(r.score),1) avg_score,count(*)::int rating_count FROM public.school_ratings r WHERE r.school_id IN(SELECT school_id FROM jobs) GROUP BY r.school_id)
 SELECT a.id,a.subject,a.assignment_date,a.start_time,a.end_time,a.description,a.compensation,a.status,coalesce(a.assigned_substitute_id=auth.uid(),false),s.name,
 CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.contact_person END,CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.phone END,CASE WHEN a.assigned_substitute_id=auth.uid() THEN s.email END,
 sc.avg_score,coalesce(sc.rating_count,0),public.assignment_completed(a.id),EXISTS(SELECT 1 FROM public.school_ratings r WHERE r.assignment_id=a.id),ap.status,
 (SELECT c.status FROM public.cancellation_requests c WHERE c.assignment_id=a.id AND (c.requester_id=auth.uid() OR a.assigned_substitute_id=auth.uid()) ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 1)
 FROM jobs a JOIN public.schools s ON s.id=a.school_id LEFT JOIN scores sc ON sc.school_id=s.id LEFT JOIN public.assignment_applications ap ON ap.assignment_id=a.id AND ap.substitute_id=auth.uid()
 ORDER BY ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now(),
          CASE WHEN ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')>now()
               THEN (a.assignment_date+a.start_time) END ASC,
          CASE WHEN ((a.assignment_date+a.start_time) AT TIME ZONE 'Europe/Stockholm')<=now()
               THEN (a.assignment_date+a.start_time) END DESC,
          a.id
$function$;

GRANT EXECUTE ON FUNCTION public.substitute_assignments_page(integer, integer, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.substitute_assignments_page(integer, integer, date, text) TO service_role;