#!/usr/bin/env python3
"""Reset only the dedicated local pilot's assignment data; preserve Auth fixtures."""
import argparse,json,os,re,subprocess
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);a=p.parse_args()
m=json.load(open(a.manifest));container=m.get('docker_db');database=m.get('database')
if container!='reko-pilot-full-db' or database!='reko_pilot':raise SystemExit('Refusing reset outside the dedicated local pilot database')
for key in ['app_url','api_url']:
 if urlsplit(m[key]).hostname not in ('127.0.0.1','localhost'):raise SystemExit('Refusing non-local pilot manifest')
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
d=['docker','--host=unix:///var/run/docker.sock']
labels=json.loads(subprocess.check_output(d+['inspect','--format','{{json .Config.Labels}}',container],env=env,text=True))
if labels.get('reko.pilot')!='fullstack' or not re.fullmatch(r'[a-f0-9]{16}',labels.get('reko.pilot.run','')):raise SystemExit('Refusing reset: pilot ownership labels missing')
sql="""
BEGIN;
SELECT pg_advisory_xact_lock(90372113);
DO $$ BEGIN
 IF current_database()<>'reko_pilot' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools) OR EXISTS(SELECT 1 FROM public.schools WHERE is_test IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Non-test school or missing fixtures'; END IF;
 IF EXISTS(SELECT 1 FROM public.assignments WHERE description IS NULL OR description NOT LIKE 'pilot-%') THEN RAISE EXCEPTION 'Unexpected assignment data; do not reset'; END IF;
END $$;
TRUNCATE TABLE public.assignments,public.sandbox_emails RESTART IDENTITY CASCADE;
COMMIT;
"""
r=subprocess.run(d+['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,env=env,capture_output=True)
if r.returncode:raise SystemExit('Reset refused or failed; inspect the isolated local database before proceeding')
print(json.dumps({'reset':True,'scope':'dedicated local pilot assignments and dependent records, plus captured test emails; Auth and profile fixtures preserved'}))
