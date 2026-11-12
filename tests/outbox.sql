-- Runs only in scripts/test-db.sh's disposable local database.
DO $$
DECLARE
 v_admin uuid:='a1210000-0000-0000-0000-000000000001';
 v_sub uuid:='a1210000-0000-0000-0000-000000000002';
 v_sub2 uuid:='a1210000-0000-0000-0000-000000000003';
 v_school uuid:='a1210000-0000-0000-0000-000000000004';
 v_assignment uuid:='a1210000-0000-0000-0000-000000000005';
 v_history uuid:='a1210000-0000-0000-0000-000000000006';
 v_job public.email_outbox; v_new public.email_outbox; v_count integer;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES
 (v_admin,'outbox-admin@example.com','{"full_name":"Outbox Admin"}',now()),
 (v_sub,'outbox-sub@example.com','{"full_name":"Outbox Vikarie"}',now()),
 (v_sub2,'outbox-sub2@example.com','{"full_name":"Outbox Vikarie Två"}',now());
 INSERT INTO public.user_roles(user_id,role) VALUES(v_admin,'admin') ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 UPDATE public.profiles SET phone='0701234567',street_address='Testgatan 1',postal_code='12345',city='Teststad',approved=true,background_status='approved',is_test=true WHERE id IN(v_sub,v_sub2);
 INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city,is_test)
 VALUES(v_school,'Outbox Testskola','Testkontakt','outbox-school@example.com','0701234567','Testgatan 1','12345','Teststad',true);
 INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time)
 VALUES(v_assignment,v_school,'Matematik',current_date+7,'09:00','10:00');
 UPDATE public.assignments SET status='filled',assigned_substitute_id=v_sub,assigned_at=now() WHERE id=v_assignment;
 SELECT count(*) INTO v_count FROM public.email_outbox WHERE assignment_id=v_assignment;
 IF v_count<>2 THEN RAISE EXCEPTION 'Booking did not atomically queue both recipients'; END IF;
 -- A retry/no-op update cannot enqueue a duplicate event.
 UPDATE public.assignments SET status='filled' WHERE id=v_assignment;
 IF (SELECT count(*) FROM public.email_outbox WHERE assignment_id=v_assignment)<>2 THEN RAISE EXCEPTION 'Duplicate booking notices'; END IF;
 SELECT * INTO v_job FROM public.claim_email_outbox(1);
 IF v_job.id IS NULL OR v_job.attempts<>1 OR v_job.lock_token IS NULL THEN RAISE EXCEPTION 'Queue leasing failed'; END IF;
 IF public.finish_email_outbox(v_job.id,gen_random_uuid(),'sent',NULL) THEN RAISE EXCEPTION 'Foreign lease completed'; END IF;
 IF NOT public.capture_email_outbox(v_job.id,v_job.lock_token) THEN RAISE EXCEPTION 'Capture failed'; END IF;
 IF public.capture_email_outbox(v_job.id,v_job.lock_token) THEN RAISE EXCEPTION 'Stale lease captured again'; END IF;
 IF (SELECT count(*) FROM public.sandbox_emails WHERE outbox_id=v_job.id)<>1 THEN RAISE EXCEPTION 'Test inbox not deduplicated'; END IF;
 -- Reopening then assigning a different person creates fresh versioned keys.
 PERFORM public.admin_reopen_assignment(v_assignment);
 UPDATE public.assignments SET status='filled',assigned_substitute_id=v_sub2,assigned_at=now() WHERE id=v_assignment;
 IF (SELECT count(DISTINCT version) FROM public.email_outbox WHERE assignment_id=v_assignment)<>3 THEN RAISE EXCEPTION 'Reassignment did not advance notification version'; END IF;
 IF (SELECT count(*) FROM public.email_outbox WHERE assignment_id=v_assignment)<>6 THEN RAISE EXCEPTION 'Reassignment/cancellation notices missing'; END IF;
 -- Expired final leases fail visibly rather than remaining stuck forever.
 SELECT * INTO v_new FROM public.email_outbox WHERE assignment_id=v_assignment AND status='pending' LIMIT 1;
 UPDATE public.email_outbox SET status='sending',attempts=8,locked_at=now()-interval '11 minutes',lock_token=gen_random_uuid() WHERE id=v_new.id;
 PERFORM * FROM public.claim_email_outbox(1);
 IF (SELECT status FROM public.email_outbox WHERE id=v_new.id)<>'failed' THEN RAISE EXCEPTION 'Final expired lease stranded'; END IF;
 -- Insert historical work as a fixture: deleting its person must preserve filled history.
 -- Simulate legacy work that already existed before the new insert guard.
 ALTER TABLE public.assignments DISABLE TRIGGER assignments_guard_lifecycle;
 INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time,status,assigned_substitute_id,assigned_at)
 VALUES(v_history,v_school,'Matematik',current_date-7,'09:00','10:00','filled',v_sub2,now()-interval '7 days');
 ALTER TABLE public.assignments ENABLE TRIGGER assignments_guard_lifecycle;
 PERFORM public.admin_prepare_user_deletion(v_sub2);
 IF (SELECT status FROM public.assignments WHERE id=v_history)<>'filled' OR NOT public.assignment_completed(v_history)
 OR (SELECT assigned_substitute_id FROM public.assignments WHERE id=v_history) IS NOT NULL THEN
  RAISE EXCEPTION 'Deletion rewrote completed assignment history';
 END IF;
 IF (SELECT status FROM public.assignments WHERE id=v_assignment)<>'expired' THEN RAISE EXCEPTION 'Future deleted-user booking not cancelled'; END IF;
 IF public.profile_active(v_sub2) THEN RAISE EXCEPTION 'Deletion did not deactivate user'; END IF;
 -- Prepare can safely resume without producing repeated transitions/notices.
 SELECT count(*) INTO v_count FROM public.email_outbox WHERE assignment_id=v_assignment;
 PERFORM public.admin_prepare_user_deletion(v_sub2);
 IF (SELECT count(*) FROM public.email_outbox WHERE assignment_id=v_assignment)<>v_count THEN RAISE EXCEPTION 'Repeated deletion duplicated events'; END IF;
 PERFORM public.finalize_user_deletion_data(v_sub2);
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_sub2) THEN RAISE EXCEPTION 'Profile cleanup incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM public.email_outbox WHERE substitute_id=v_sub2) THEN RAISE EXCEPTION 'Deleted identity retained in queue'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_outbox WHERE assignment_id=v_assignment AND template='uppdrag-avbokat' AND recipient_kind='school' AND substitute_id IS NULL) THEN RAISE EXCEPTION 'School cancellation lost during erasure'; END IF;
 IF (SELECT status FROM public.assignments WHERE id=v_history)<>'filled' THEN RAISE EXCEPTION 'Cleanup reopened history'; END IF;
 RAISE NOTICE 'Outbox atomicity, leases, retries, capture, reassignment and deletion assertions passed';
END $$;
