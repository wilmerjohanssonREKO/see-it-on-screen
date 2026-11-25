DROP FUNCTION IF EXISTS public.admin_substitutes_page(integer, integer);

CREATE OR REPLACE FUNCTION public.admin_substitutes_page(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, full_name text, email text, phone text, approved boolean, background_status background_status, school_name text, graduation_year integer, subjects text[], availability text, has_cv boolean, is_test boolean, rating_avg numeric, rating_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,p.phone,p.approved,p.background_status,
 p.school_name,p.graduation_year,p.subjects,p.availability,p.cv_file_path IS NOT NULL,p.is_test,
 coalesce(rs.avg_score,0),coalesce(rs.rating_count,0)
 FROM public.profiles p
 LEFT JOIN LATERAL (SELECT round(avg(r.score),1) avg_score,count(*)::int rating_count
   FROM public.ratings r WHERE r.substitute_id=p.id) rs ON true
 WHERE NOT EXISTS(SELECT 1 FROM public.school_members m WHERE m.user_id=p.id)
 ORDER BY p.created_at DESC,p.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100) OFFSET GREATEST(COALESCE(p_offset,0),0);
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_substitutes_page(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_substitutes_page(integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_school_rating_summaries()
 RETURNS TABLE(school_id uuid, rating_avg numeric, rating_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT r.school_id, round(avg(r.score),1), count(*)::int
 FROM public.school_ratings r
 GROUP BY r.school_id
$function$;

GRANT EXECUTE ON FUNCTION public.admin_school_rating_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_school_rating_summaries() TO service_role;