-- Assert effective permissions after applying every migration, not source text.
DO $$
DECLARE v_table text; v_count integer;
BEGIN
 FOREACH v_table IN ARRAY ARRAY['school_invitations','assignment_applications','cancellation_requests','email_outbox','account_deletion_jobs'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity) THEN
     RAISE EXCEPTION 'RLS missing on %',v_table;
   END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.email_outbox','SELECT')
   OR has_table_privilege('anon','public.email_outbox','SELECT') THEN
   RAISE EXCEPTION 'Raw email queue exposed to application roles';
 END IF;
 IF has_function_privilege('authenticated','public.claim_email_outbox(integer)','EXECUTE')
   OR has_function_privilege('anon','public.claim_email_outbox(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Mail worker exposed to a normal caller';
 END IF;
 IF NOT has_function_privilege('service_role','public.claim_email_outbox(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Mail worker unavailable to backend';
 END IF;
 IF has_column_privilege('authenticated','public.school_invitations','token_hash','SELECT') THEN
   RAISE EXCEPTION 'Invitation hash exposed to normal role';
 END IF;
 IF has_function_privilege('anon','public.accept_school_invitation(text,text,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous invitation acceptance exposed';
 END IF;
 SELECT count(*) INTO v_count FROM pg_indexes WHERE schemaname='public' AND tablename='event_log';
 IF v_count<3 THEN RAISE EXCEPTION 'Event query indexes missing'; END IF;
 RAISE NOTICE 'Infrastructure effective-permission assertions passed';
END $$;
