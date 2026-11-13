BEGIN;
CREATE TEMP TABLE reko_extended_results(name text PRIMARY KEY,passed boolean,detail text);
GRANT ALL ON reko_extended_results TO authenticated,anon;
CREATE FUNCTION pg_temp.flow_case(p_name text,p_sql text,p_expect_error boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_ok boolean; v_error text;
BEGIN
 BEGIN
  EXECUTE p_sql INTO v_ok;
  IF p_expect_error THEN INSERT INTO reko_extended_results VALUES(p_name,false,'Expected rejection but action succeeded');
  ELSE INSERT INTO reko_extended_results VALUES(p_name,coalesce(v_ok,false),CASE WHEN coalesce(v_ok,false) THEN 'passed' ELSE 'Unexpected result/state' END); END IF;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
  INSERT INTO reko_extended_results VALUES(p_name,p_expect_error,CASE WHEN p_expect_error THEN 'Rejected as expected' ELSE left(v_error,200) END);
 END;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES
 ('61000000-0000-0000-0000-000000000001','extended-admin@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000002','extended-school-a@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000003','extended-school-b@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000004','extended-sub-a@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000005','extended-sub-b@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000006','extended-withdrawn@local.invalid',now(),'fixture'),
 ('61000000-0000-0000-0000-000000000007','extended-unapproved@local.invalid',now(),'fixture');
INSERT INTO public.user_roles(user_id,role) VALUES('61000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
UPDATE public.profiles SET full_name='Extended fixture',phone='0701234567',street_address='Testgatan 1',postal_code='41111',city='Göteborg',approved=true,background_status='approved',is_test=true WHERE id::text LIKE '61000000-%';
UPDATE public.profiles SET approved=false WHERE id='61000000-0000-0000-0000-000000000007';
INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city,is_test) VALUES
 ('62000000-0000-0000-0000-000000000001','Extended School A','Fixture','extended-a@local.invalid','0701234567','Testgatan 1','41111','Göteborg',true),
 ('62000000-0000-0000-0000-000000000002','Extended School B','Fixture','extended-b@local.invalid','0701234567','Testgatan 2','41111','Göteborg',true);
INSERT INTO public.school_members(user_id,school_id) VALUES
 ('61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001'),
 ('61000000-0000-0000-0000-000000000003','62000000-0000-0000-0000-000000000002');
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('63000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','Cancellation fixture',current_date+4,'09:00','10:00'),
 ('63000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001','Withdrawal fixture',current_date+4,'10:00','11:00'),
 ('63000000-0000-0000-0000-000000000003','62000000-0000-0000-0000-000000000001','Privacy fixture',current_date+4,'12:00','13:00'),
 ('63000000-0000-0000-0000-000000000004','62000000-0000-0000-0000-000000000002','Foreign fixture',current_date+4,'14:00','15:00');
ALTER TABLE public.assignments DISABLE TRIGGER assignments_guard_lifecycle;
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time,status,assigned_substitute_id) VALUES
 ('63000000-0000-0000-0000-000000000005','62000000-0000-0000-0000-000000000001','History fixture',current_date-4,'09:00','10:00','filled','61000000-0000-0000-0000-000000000004');
ALTER TABLE public.assignments ENABLE TRIGGER assignments_guard_lifecycle;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000007',true);
SELECT pg_temp.flow_case('01 unapproved cannot apply',$q$SELECT public.apply_assignment('63000000-0000-0000-0000-000000000001')='not_approved'$q$);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.flow_case('02 first application works',$q$SELECT public.apply_assignment('63000000-0000-0000-0000-000000000001')='applied'$q$);
SELECT pg_temp.flow_case('03 repeat application returns same result',$q$SELECT public.apply_assignment('63000000-0000-0000-0000-000000000001')='applied'$q$);
SELECT pg_temp.flow_case('04 repeat application has one application row',$q$SELECT count(*)=1 FROM public.assignment_applications WHERE assignment_id='63000000-0000-0000-0000-000000000001'$q$);
SELECT pg_temp.flow_case('05 applicant cannot choose himself',$q$SELECT public.select_applicant('63000000-0000-0000-0000-000000000001',auth.uid())='selected'$q$,true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000005',true);
SELECT public.apply_assignment('63000000-0000-0000-0000-000000000002');
SELECT pg_temp.flow_case('06 pending application can withdraw',$q$SELECT public.withdraw_application('63000000-0000-0000-0000-000000000002')$q$);
SELECT pg_temp.flow_case('07 repeat withdrawal is no-op',$q$SELECT NOT public.withdraw_application('63000000-0000-0000-0000-000000000002')$q$);
SELECT pg_temp.flow_case('08 withdrawn can reapply',$q$SELECT public.apply_assignment('63000000-0000-0000-0000-000000000002')='applied'$q$);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.flow_case('09 owner sees pending candidate',$q$SELECT public.can_view_substitute('61000000-0000-0000-0000-000000000005')$q$);
SELECT pg_temp.flow_case('10 owner chooses first candidate',$q$SELECT public.select_applicant('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000004')='selected'$q$);
SELECT pg_temp.flow_case('11 repeated choice is unavailable',$q$SELECT public.select_applicant('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000004')='unavailable'$q$);
SELECT pg_temp.flow_case('12 invalid backwards times rejected',$q$SELECT public.create_and_publish_assignment('Invalid',current_date+4,'12:00','11:00','','')>=0$q$,true);
SELECT pg_temp.flow_case('13 equal times rejected',$q$SELECT public.create_and_publish_assignment('Invalid',current_date+4,'12:00','12:00','','')>=0$q$,true);
SELECT pg_temp.flow_case('14 null start rejected',$q$SELECT public.create_and_publish_assignment('Invalid',current_date+4,NULL,'12:00','','')>=0$q$,true);
SELECT pg_temp.flow_case('15 yesterday rejected',$q$SELECT public.create_and_publish_assignment('Invalid',current_date-1,'10:00','12:00','','')>=0$q$,true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.flow_case('16 foreign school has no CV relationship',$q$SELECT NOT public.can_view_substitute('61000000-0000-0000-0000-000000000005')$q$);
SELECT pg_temp.flow_case('17 foreign school cancellation denied',$q$SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000001','Not participant') IS NOT NULL$q$,true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.flow_case('18 selected candidate cannot withdraw application',$q$SELECT NOT public.withdraw_application('63000000-0000-0000-0000-000000000001')$q$);
SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000001','First reason') AS first_request \gset
SELECT pg_temp.flow_case('19 repeat cancellation reuses request',$q$SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000001','Updated reason')=(SELECT id FROM public.cancellation_requests WHERE assignment_id='63000000-0000-0000-0000-000000000001' AND status='pending')$q$);
SELECT pg_temp.flow_case('20 repeated cancellation updates reason',$q$SELECT reason='Updated reason' FROM public.cancellation_requests WHERE assignment_id='63000000-0000-0000-0000-000000000001' AND status='pending'$q$);
SELECT pg_temp.flow_case('21 party cannot resolve cancellation',$q$SELECT public.admin_resolve_cancellation((SELECT id FROM public.cancellation_requests WHERE assignment_id='63000000-0000-0000-0000-000000000001' AND status='pending'),false)$q$,true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.flow_case('22 admin can deny cancellation',format('SELECT public.admin_resolve_cancellation(%L,false)',:'first_request'));
SELECT pg_temp.flow_case('23 denial preserves booking',$q$SELECT status='filled' AND assigned_substitute_id='61000000-0000-0000-0000-000000000004' FROM public.assignments WHERE id='63000000-0000-0000-0000-000000000001'$q$);
SELECT pg_temp.flow_case('24 repeat resolution is no-op',format('SELECT NOT public.admin_resolve_cancellation(%L,true)',:'first_request'));
SELECT pg_temp.flow_case('25 history reopen rejected',$q$SELECT public.admin_reopen_assignment('63000000-0000-0000-0000-000000000005')$q$,true);
SELECT pg_temp.flow_case('26 history expire rejected',$q$SELECT public.admin_expire_assignment('63000000-0000-0000-0000-000000000005')$q$,true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000006',true);
SELECT public.apply_assignment('63000000-0000-0000-0000-000000000003');
SELECT public.withdraw_application('63000000-0000-0000-0000-000000000003');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT public.apply_assignment('63000000-0000-0000-0000-000000000003');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SELECT public.select_applicant('63000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000004');
SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000003','Internal absence detail') AS privacy_request \gset
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
SELECT public.admin_resolve_cancellation(:'privacy_request',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.flow_case('27 withdrawn nonparty has no direct cancellation access',$q$SELECT count(*)=0 FROM public.cancellation_requests WHERE assignment_id='63000000-0000-0000-0000-000000000003'$q$);
SELECT pg_temp.flow_case('28 withdrawn nonparty has no cancellation reason via RPC',$q$SELECT count(*)=0 FROM public.my_cancellation_requests() WHERE assignment_id='63000000-0000-0000-0000-000000000003'$q$);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.flow_case('29 selected former party retains cancellation notice',$q$SELECT count(*)=1 FROM public.my_cancellation_requests() WHERE assignment_id='63000000-0000-0000-0000-000000000003' AND status='approved'$q$);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.flow_case('30 owner cannot view withdrawn candidate file relationship',$q$SELECT NOT public.can_view_substitute('61000000-0000-0000-0000-000000000006')$q$);
RESET ROLE;
SELECT pg_temp.flow_case('31 repeated application logged once',$q$SELECT count(*)=1 FROM public.event_log WHERE assignment_id='63000000-0000-0000-0000-000000000001' AND event_type='application_submitted'$q$);
-- A later allocation must not disclose its reason to an earlier selected party.
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('63000000-0000-0000-0000-000000000006','62000000-0000-0000-0000-000000000001','Reallocation privacy',current_date+4,'16:00','17:00');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT public.apply_assignment('63000000-0000-0000-0000-000000000006');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SELECT public.select_applicant('63000000-0000-0000-0000-000000000006','61000000-0000-0000-0000-000000000004');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000006','A first cancellation') AS allocation_a_request \gset
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
SELECT public.admin_resolve_cancellation(:'allocation_a_request',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000005',true);
SELECT public.apply_assignment('63000000-0000-0000-0000-000000000006');
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SELECT public.select_applicant('63000000-0000-0000-0000-000000000006','61000000-0000-0000-0000-000000000005');
SELECT public.request_assignment_cancellation('63000000-0000-0000-0000-000000000006','Private B cancellation reason') AS allocation_b_request \gset
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
SELECT public.admin_resolve_cancellation(:'allocation_b_request',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.flow_case('32 old assignee cannot read later allocation reason via RPC',format('SELECT count(*)=0 FROM public.my_cancellation_requests() WHERE id=%L',:'allocation_b_request'));
SELECT pg_temp.flow_case('33 old assignee cannot read later allocation reason directly',format('SELECT count(*)=0 FROM public.cancellation_requests WHERE id=%L',:'allocation_b_request'));
SELECT pg_temp.flow_case('34 old assignee retains own earlier cancellation',format('SELECT count(*)=1 FROM public.my_cancellation_requests() WHERE id=%L',:'allocation_a_request'));
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.flow_case('35 actual later assignee receives own allocation notice',format('SELECT count(*)=1 FROM public.my_cancellation_requests() WHERE id=%L',:'allocation_b_request'));
RESET ROLE;
SELECT json_build_object('suite','extended_flows','passed',count(*) FILTER(WHERE passed),'failed',count(*) FILTER(WHERE NOT passed),'total',count(*)) FROM reko_extended_results;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM reko_extended_results ORDER BY name) t;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM reko_extended_results WHERE NOT passed) THEN RAISE EXCEPTION 'Extended flow regressions failed; inspect recorded cases'; END IF; END $$;
ROLLBACK;
