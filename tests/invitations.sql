-- Fake identities only; every change rolls back after exercising real functions.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES
 ('20000000-0000-0000-0000-000000000001','invite-admin@local.invalid',now(),'fixture-hash'),
 ('20000000-0000-0000-0000-000000000002','invite-teacher@local.invalid',now(),'fixture-hash'),
 ('20000000-0000-0000-0000-000000000003','invite-other@local.invalid',now(),'fixture-hash'),
 ('20000000-0000-0000-0000-000000000004','invite-unverified@local.invalid',NULL,'fixture-hash'),
 ('20000000-0000-0000-0000-000000000005','invite-no-password@local.invalid',now(),NULL),
 ('20000000-0000-0000-0000-000000000006','invite-sandbox@local.invalid',now(),'fixture-hash');
INSERT INTO public.user_roles(user_id,role) VALUES('20000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city) VALUES
 ('21000000-0000-0000-0000-000000000001','Invitation fixture school','Fixture contact','invite-school@local.invalid','0701234567','Testgatan 1','41111','Göteborg');
UPDATE public.profiles SET is_test=true WHERE id='20000000-0000-0000-0000-000000000006';

CREATE FUNCTION pg_temp.expect_invitation_failure(p_sql text,p_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_failed boolean:=false;
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
   IF position(p_message IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected failure: %',SQLERRM; END IF;
   v_failed:=true;
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'Forbidden invitation action succeeded: %',p_message; END IF;
END $$;

SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-teacher@local.invalid','teacher',encode(extensions.digest(repeat('a',64),'sha256'),'hex'));
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('a',64),'Fixture Teacher','0701234567')$q$,'e-postadressen');
SELECT pg_temp.expect_invitation_failure($q$SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','uninvited@local.invalid','teacher',repeat('0',64))$q$,'Endast admin');

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-unverified@local.invalid','teacher',encode(extensions.digest(repeat('b',64),'sha256'),'hex'));
SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-no-password@local.invalid','teacher',encode(extensions.digest(repeat('c',64),'sha256'),'hex'));
SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-sandbox@local.invalid','teacher',encode(extensions.digest(repeat('d',64),'sha256'),'hex'));
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('b',64),'Fixture Teacher','0701234567')$q$,'Bekräfta');
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('c',64),'Fixture Teacher','0701234567')$q$,'lösenord');
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('d',64),'Fixture Teacher','0701234567')$q$,'testläge');

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
UPDATE public.school_invitations SET expires_at=now()-interval '1 second' WHERE email='invite-teacher@local.invalid';
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('a',64),'Fixture Teacher','0701234567')$q$,'ogiltig');

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-other@local.invalid','teacher',encode(extensions.digest(repeat('f',64),'sha256'),'hex'));
SELECT public.revoke_school_invitation(id) FROM public.school_invitations WHERE email='invite-other@local.invalid';
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('f',64),'Fixture Teacher','0701234567')$q$,'ogiltig');

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT public.create_school_invitation('21000000-0000-0000-0000-000000000001','invite-teacher@local.invalid','teacher',encode(extensions.digest(repeat('e',64),'sha256'),'hex'));
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_school_invitation(repeat('e',64),'Fixture Teacher','0701234567');
SELECT pg_temp.expect_invitation_failure($q$SELECT public.accept_school_invitation(repeat('e',64),'Fixture Teacher','0701234567')$q$,'ogiltig');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.school_members WHERE user_id=auth.uid() AND school_id='21000000-0000-0000-0000-000000000001' AND member_type='teacher') THEN RAISE EXCEPTION 'Verified invitation did not activate membership'; END IF;
 RAISE NOTICE 'Invitation identity, email verification, password, expiry, revocation, replay and sandbox assertions passed';
END $$;
RESET ROLE;
ROLLBACK;
