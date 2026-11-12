-- Admin lists filter before pagination; never download all memberships to the browser.
CREATE OR REPLACE FUNCTION public.admin_substitutes_page(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, full_name text, email text, phone text, approved boolean,
 background_status public.background_status, school_name text, graduation_year integer,
 subjects text[], availability text, has_cv boolean, is_test boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,p.phone,p.approved,p.background_status,
 p.school_name,p.graduation_year,p.subjects,p.availability,p.cv_file_path IS NOT NULL,p.is_test
 FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.school_members m WHERE m.user_id=p.id)
 ORDER BY p.created_at DESC,p.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100) OFFSET GREATEST(COALESCE(p_offset,0),0);
END $$;
REVOKE ALL ON FUNCTION public.admin_substitutes_page(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_substitutes_page(integer,integer) TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS profiles_created_id_idx ON public.profiles(created_at DESC,id);
CREATE INDEX IF NOT EXISTS feedback_created_id_idx ON public.feedback(created_at DESC,id);
CREATE INDEX IF NOT EXISTS ratings_created_id_idx ON public.ratings(created_at DESC,id);
CREATE INDEX IF NOT EXISTS school_ratings_created_id_idx ON public.school_ratings(created_at DESC,id);

-- Keyset exports do not shift when new rows are inserted during a download.
CREATE OR REPLACE FUNCTION public.admin_event_log_export_page(p_before timestamptz,p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL,p_limit integer DEFAULT 500)
RETURNS TABLE(id uuid,occurred_at timestamptz,event_type text,assignment_id uuid,school_id uuid,substitute_ref text,metadata jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT e.id,e.occurred_at,e.event_type,e.assignment_id,e.school_id,e.substitute_ref,e.metadata FROM public.event_log e
 WHERE e.occurred_at<=p_before AND (p_cursor_at IS NULL OR (e.occurred_at,e.id)<(p_cursor_at,p_cursor_id))
 ORDER BY e.occurred_at DESC,e.id DESC LIMIT greatest(1,least(coalesce(p_limit,500),500));
END $$;
CREATE OR REPLACE FUNCTION public.admin_assignment_metrics_export_page(p_before timestamptz,p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL,p_limit integer DEFAULT 500)
RETURNS SETOF public.assignment_metrics LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) OR NOT public.profile_active(auth.uid()) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT m.* FROM public.assignment_metrics m
 WHERE m.created_at<=p_before AND (p_cursor_at IS NULL OR (m.created_at,m.assignment_id)<(p_cursor_at,p_cursor_id))
 ORDER BY m.created_at DESC,m.assignment_id DESC LIMIT greatest(1,least(coalesce(p_limit,500),500));
END $$;
REVOKE ALL ON FUNCTION public.admin_event_log_export_page(timestamptz,timestamptz,uuid,integer),public.admin_assignment_metrics_export_page(timestamptz,timestamptz,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_event_log_export_page(timestamptz,timestamptz,uuid,integer),public.admin_assignment_metrics_export_page(timestamptz,timestamptz,uuid,integer) TO authenticated,service_role;

-- Preserve historical bookings even if a school is deleted through the direct API.
CREATE FUNCTION public.guard_school_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.assignments WHERE school_id=OLD.id) THEN
  RAISE EXCEPTION 'Skolor med uppdragshistorik får inte raderas';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.guard_school_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER schools_preserve_history BEFORE DELETE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.guard_school_history();
