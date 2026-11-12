-- Synthetic local identities only; test real RPC and RLS behavior under app roles.
BEGIN;
CREATE FUNCTION pg_temp.check_ok(value boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF;
END $$;
CREATE FUNCTION pg_temp.must_fail(command text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean:=false; BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Forbidden action succeeded: %',command; END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('30000000-0000-0000-0000-000000000001','booking-admin@local.invalid',now()),
 ('30000000-0000-0000-0000-000000000002','booking-school-a@local.invalid',now()),
 ('30000000-0000-0000-0000-000000000003','booking-school-b@local.invalid',now()),
 ('30000000-0000-0000-0000-000000000004','booking-sub@local.invalid',now()),
 ('30000000-0000-0000-0000-000000000005','booking-sub-two@local.invalid',now()),
 ('30000000-0000-0000-0000-000000000006','booking-real-mode@local.invalid',now());
INSERT INTO public.user_roles(user_id,role) VALUES('30000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
UPDATE public.profiles SET full_name='Booking fixture',phone='0701234567',street_address='Testgatan 1',postal_code='41111',city='Göteborg',approved=true,background_status='approved',is_test=true WHERE id::text LIKE '30000000-%';
UPDATE public.profiles SET is_test=false WHERE id='30000000-0000-0000-0000-000000000006';
INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city,is_test) VALUES
 ('31000000-0000-0000-0000-000000000001','Booking A','Fixture','booking-a@local.invalid','0701234567','Testgatan 1','41111','Göteborg',true),
 ('31000000-0000-0000-0000-000000000002','Booking B','Fixture','booking-b@local.invalid','0701234567','Testgatan 2','41111','Göteborg',true);
INSERT INTO public.school_members(user_id,school_id) VALUES
 ('30000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000002');
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Fixture',current_date+3,'09:00','11:00'),
 ('32000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','Fixture',current_date+3,'10:00','12:00'),
 ('32000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','Fixture',current_date+3,'12:00','13:00');
-- Legacy expired open fixture simulates records that predate the guard.
ALTER TABLE public.assignments DISABLE TRIGGER assignments_guard_lifecycle;
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('32000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000001','Legacy expired',current_date-3,'09:00','11:00');
ALTER TABLE public.assignments ENABLE TRIGGER assignments_guard_lifecycle;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.check_ok(public.claim_assignment('32000000-0000-0000-0000-000000000001')='applied','legacy claim only applies');
SELECT pg_temp.check_ok((SELECT status='open' AND assigned_substitute_id IS NULL FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000001'),'application must not allocate');
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000002')='applied','apply to other school');
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000004')='unavailable','past job unavailable');
SELECT pg_temp.check_ok(NOT EXISTS(SELECT 1 FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000004'),'past job hidden directly');
SELECT pg_temp.must_fail($q$UPDATE public.profiles SET deactivated_at=now() WHERE id=auth.uid()$q$);
SELECT public.log_assignment_view('32000000-0000-0000-0000-000000000001');
SELECT public.log_assignment_view('32000000-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000001')='unavailable','cross-sandbox apply denied');
SELECT pg_temp.check_ok(NOT EXISTS(SELECT 1 FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000001'),'cross-sandbox direct read denied');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000003')='applied','second applicant');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.must_fail($q$SELECT * FROM public.school_applicants('32000000-0000-0000-0000-000000000001')$q$);
SELECT pg_temp.must_fail($q$SELECT public.select_applicant('32000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004')$q$);
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.check_ok(public.can_view_substitute('30000000-0000-0000-0000-000000000004'),'own pending applicant profile accessible');
SELECT pg_temp.check_ok(public.select_applicant('32000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004')='selected','school chooses');
SELECT pg_temp.check_ok(public.reject_applicant('32000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000005'),'reject pending applicant');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.check_ok(NOT EXISTS(SELECT 1 FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000003'),'rejected direct REST hidden');
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000003')='unavailable','rejected cannot reapply');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.check_ok(public.select_applicant('32000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004')='overlap','other school cannot double book');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',true);
SELECT public.request_assignment_cancellation('32000000-0000-0000-0000-000000000001','Fixture cancellation') AS request_id \gset
SELECT pg_temp.check_ok((SELECT status='filled' FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000001'),'request alone preserves booking');
SELECT pg_temp.must_fail(format('SELECT public.admin_resolve_cancellation(%L,true)',:'request_id'));
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.check_ok(public.admin_resolve_cancellation(:'request_id',true),'admin approves cancellation');
SELECT pg_temp.check_ok((SELECT status='open' AND assigned_substitute_id IS NULL AND assigned_at IS NULL FROM public.assignments WHERE id='32000000-0000-0000-0000-000000000001'),'reopened identity cleared');
SELECT pg_temp.check_ok((SELECT count(*)=1 FROM public.event_log WHERE assignment_id='32000000-0000-0000-0000-000000000001' AND event_type='notification_viewed'),'view logging deduped');
RESET ROLE;
SELECT pg_temp.check_ok((SELECT count(*)=4 FROM public.email_outbox WHERE assignment_id='32000000-0000-0000-0000-000000000001'),'selection and cancellation durable pair each');
SET LOCAL ROLE authenticated;
SELECT pg_temp.must_fail($q$DELETE FROM public.schools WHERE id='31000000-0000-0000-0000-000000000001'$q$);
SELECT pg_temp.must_fail($q$SELECT public.admin_reopen_assignment('32000000-0000-0000-0000-000000000004')$q$);
SELECT pg_temp.must_fail($q$SELECT public.admin_create_and_publish_assignment('31000000-0000-0000-0000-000000000001','Past',current_date-1,'09:00','11:00','','')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
UPDATE public.profiles SET deactivated_at=now() WHERE id='30000000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.check_ok(public.apply_assignment('32000000-0000-0000-0000-000000000002')='not_approved','deactivated cannot apply');
SELECT pg_temp.must_fail($q$UPDATE public.profiles SET deactivated_at=NULL WHERE id=auth.uid()$q$);
RESET ROLE;
ROLLBACK;
