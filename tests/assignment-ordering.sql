-- Synthetic local identities only; verify schema list ordering for substitutes.
BEGIN;
CREATE FUNCTION pg_temp.check_ok(value boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('62000000-0000-0000-0000-000000000001','ordering-school@local.invalid',now()),
 ('62000000-0000-0000-0000-000000000002','ordering-sub@local.invalid',now());
INSERT INTO public.user_roles(user_id,role) VALUES ('62000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claim.sub','62000000-0000-0000-0000-000000000001',true);
UPDATE public.profiles SET full_name='Ordering fixture',phone='0701234567',approved=true,background_status='approved' WHERE id::text LIKE '62000000-%';
INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city) VALUES
 ('63000000-0000-0000-0000-000000000001','Ordering A','Fixture','ordering-a@local.invalid','0701234567','Testgatan 1','41111','Göteborg');
INSERT INTO public.school_members(user_id,school_id,member_type) VALUES
 ('62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','school');
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('64000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','Ämne A',current_date+7,'09:00','11:00'),
 ('64000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000001','Ämne B',current_date+1,'09:00','11:00');
-- Past records predate the lifecycle guard: insert them with the trigger off.
ALTER TABLE public.assignments DISABLE TRIGGER assignments_guard_lifecycle;
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('64000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000001','Ämne C',current_date-3,'09:00','11:00'),
 ('64000000-0000-0000-0000-000000000004','63000000-0000-0000-0000-000000000001','Ämne D',current_date-1,'09:00','11:00');
UPDATE public.assignments SET status='filled',assigned_substitute_id='62000000-0000-0000-0000-000000000002',assigned_at=now()
 WHERE id IN ('64000000-0000-0000-0000-000000000003','64000000-0000-0000-0000-000000000004');
ALTER TABLE public.assignments ENABLE TRIGGER assignments_guard_lifecycle;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','62000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.check_ok(
 (SELECT array_agg(id) FROM public.substitute_assignments_page(25,0,NULL,NULL))
 = array['64000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001',
          '64000000-0000-0000-0000-000000000004','64000000-0000-0000-0000-000000000003']::uuid[],
 'nearest upcoming first, then most recent past');
SELECT pg_temp.check_ok(
 (SELECT array_agg(id) FROM public.substitute_assignments_page(25,0,NULL,'Ämne B'))
 = array['64000000-0000-0000-0000-000000000002']::uuid[],
 'subject filter keeps the nearest-first order');
SELECT pg_temp.check_ok(
 (SELECT array_agg(id) FROM public.substitute_assignments_page(1,0,NULL,NULL))
 = array['64000000-0000-0000-0000-000000000002']::uuid[],
 'first page holds the nearest upcoming assignment');
COMMIT;
