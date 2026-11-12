#!/usr/bin/env bash
# Called by test-db.sh only; concurrent sessions target its throwaway container.
set -euo pipefail
container="${1:?local test container required}"
[[ "$container" == reko-sql-test-* ]] || { echo 'Refusing non-test container' >&2; exit 1; }
docker_cli=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
sql() { "${docker_cli[@]}" exec -i "$container" psql -X -qAt -U postgres -d reko_test -v ON_ERROR_STOP=1; }
logs="$(mktemp -d /tmp/reko-sql-concurrency.XXXXXX)"
trap 'rm -rf "$logs"' EXIT
sql >/dev/null <<'SQL'
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('90000000-0000-0000-0000-000000000001','race-admin@local.invalid',now()),
 ('90000000-0000-0000-0000-000000000002','race-school-a@local.invalid',now()),
 ('90000000-0000-0000-0000-000000000003','race-school-b@local.invalid',now()),
 ('90000000-0000-0000-0000-000000000004','race-substitute@local.invalid',now());
INSERT INTO public.user_roles(user_id,role) VALUES('90000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',false);
UPDATE public.profiles SET full_name='Concurrent fixture',phone='0701234567',street_address='Testgatan 1',postal_code='41111',city='Göteborg',approved=true,background_status='approved',is_test=true
 WHERE id::text LIKE '90000000-%';
INSERT INTO public.schools(id,name,contact_person,email,phone,street_address,postal_code,city,is_test) VALUES
 ('91000000-0000-0000-0000-000000000001','Concurrent A','Fixture contact','race-a@local.invalid','0701234567','Testgatan 1','41111','Göteborg',true),
 ('91000000-0000-0000-0000-000000000002','Concurrent B','Fixture contact','race-b@local.invalid','0701234567','Testgatan 2','41111','Göteborg',true);
INSERT INTO public.school_members(user_id,school_id) VALUES
 ('90000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001'),
 ('90000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000002');
INSERT INTO public.assignments(id,school_id,subject,assignment_date,start_time,end_time) VALUES
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Race fixture',current_date+2,'10:00','12:00'),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','Race fixture',current_date+2,'11:00','13:00');
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',false);
SET ROLE authenticated;
SELECT public.apply_assignment('92000000-0000-0000-0000-000000000001');
SELECT public.apply_assignment('92000000-0000-0000-0000-000000000002');
SQL
sql >"$logs/a" 2>&1 <<'SQL' &
SET application_name='reko-select-A';
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10s';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
SELECT public.select_applicant('92000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004');
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
ready=false
for attempt in {1..60}; do
  sleeping="$(sql <<'SQL'
SELECT count(*) FROM pg_stat_activity WHERE application_name='reko-select-A' AND wait_event='PgSleep';
SQL
)"
  if [[ "$sleeping" == 1 ]]; then ready=true; break; fi
  sleep 0.05
done
[[ "$ready" == true ]] || { cat "$logs/a"; echo 'First selection never acquired locks' >&2; exit 1; }
sql >"$logs/b" 2>&1 <<'SQL'
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10s';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
SELECT public.select_applicant('92000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004');
COMMIT;
SQL
wait "$first_pid"
grep -qx selected "$logs/a"
grep -qx overlap "$logs/b"
sql <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.assignments WHERE assigned_substitute_id='90000000-0000-0000-0000-000000000004' AND status='filled')<>1 THEN
  RAISE EXCEPTION 'Concurrent schools double-booked the substitute';
 END IF;
 IF (SELECT count(*) FROM public.email_outbox WHERE assignment_id IN ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002'))<>2 THEN
  RAISE EXCEPTION 'Concurrent selection did not enqueue exactly one booking pair';
 END IF;
END $$;
SQL
echo 'Concurrent overlapping selection passed: one selected, one overlap, two durable emails.'
