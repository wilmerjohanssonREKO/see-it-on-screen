#!/usr/bin/env python3
"""Isolated real Auth/PostgREST/Storage pilot. No production URLs or credentials."""
import os,sys,pathlib,json,subprocess,time,threading,http.client,io,base64,hmac,hashlib,secrets,signal,urllib.parse,fcntl
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
BASE=pathlib.Path(__file__).resolve().parent;ROOT=pathlib.Path(os.environ.get('REKO_PILOT_SOURCE',str(BASE.parents[2]))).resolve();RUNTIME=BASE/'runtime';RUNTIME.mkdir(exist_ok=True);os.chmod(RUNTIME,0o700)
D=['docker','--host=unix:///var/run/docker.sock'];ENV=os.environ.copy()
for k in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:ENV.pop(k,None)
LOCK=(RUNTIME/'stack.lock').open('w');fcntl.flock(LOCK,fcntl.LOCK_EX|fcntl.LOCK_NB)
RUN_ID=secrets.token_hex(8)
WITHOUT_STORAGE='--without-storage' in sys.argv
NET='reko-pilot-full-net';DB='reko-pilot-full-db';API='http://127.0.0.1:54451';APP='http://127.0.0.1:5182';PASSWORD=secrets.token_hex(20);JWT=secrets.token_hex(32)
CONTAINERS=[DB,'reko-pilot-full-auth','reko-pilot-full-rest','reko-pilot-full-storage','reko-pilot-full-mail']
IMAGES={'db':'postgres:17-alpine','auth':'supabase/gotrue:v2.183.0','rest':'postgrest/postgrest:v13.0.5','storage':os.environ.get('REKO_PILOT_STORAGE_IMAGE','supabase/storage-api:v1.26.0'),'mail':'axllent/mailpit:v1.27.8'}
NO_EGRESS={'HTTP_PROXY':'','HTTPS_PROXY':'','ALL_PROXY':'','http_proxy':'','https_proxy':'','all_proxy':''}
def docker(*args,input=None,check=True):
 p=subprocess.run(D+list(args),env=ENV,input=input,capture_output=True,text=True)
 if check and p.returncode:raise RuntimeError('Docker '+args[0]+' failed: '+p.stderr[-350:])
 return p.stdout.strip()
def run(name,image,env=None):
 args=['run','-d','--name',name,'--network',NET,'--label','reko.pilot=fullstack','--label','reko.pilot.run='+RUN_ID]
 for k,v in {**NO_EGRESS,**(env or {})}.items():args+=['-e',f'{k}={v}']
 docker(*args,image)
def sql(q):return docker('exec','-i',DB,'psql','-X','-qAt','-U','postgres','-d','reko_pilot','-v','ON_ERROR_STOP=1',input=q)
def jwt(role):
 enc=lambda d:base64.urlsafe_b64encode(json.dumps(d,separators=(',',':')).encode()).decode().rstrip('=')
 x=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'iss':'supabase','role':role,'iat':int(time.time()),'exp':int(time.time())+86400})
 return x+'.'+base64.urlsafe_b64encode(hmac.new(JWT.encode(),x.encode(),hashlib.sha256).digest()).decode().rstrip('=')
ANON=jwt('anon');SERVICE=jwt('service_role')
def internal(service,port,method,path,body=b'',headers=None):
 headers={'Host':f'{service}:{port}','Connection':'close','Content-Length':str(len(body)),**(headers or {})}
 wire=(f'{method} {path} HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in headers.items())+'\r\n').encode()+body
 p=subprocess.Popen(D+['exec','-i',DB,'nc','-w','15',service,str(port)],env=ENV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 p.stdin.write(wire);p.stdin.flush()
 class Socket:
  def makefile(self,*args):return p.stdout
 try:
  r=http.client.HTTPResponse(Socket());r.begin();return r.status,dict(r.headers),r.read()
 finally:
  p.stdin.close()
  try:p.wait(timeout=2)
  except subprocess.TimeoutExpired:p.terminate();p.wait(timeout=2)
def request(service,path,method='GET',data=None,headers=None):
 body=b'' if data is None else json.dumps(data).encode()
 status,hs,raw=internal(service,9999 if service.endswith('auth') else 8025,method,path,body,{'Content-Type':'application/json',**(headers or {})})
 try:result=json.loads(raw)
 except:result={}
 if status>=400:raise RuntimeError(f'Local {service} {path.split("?")[0]} returned {status}: '+str(result)[:200])
 return result
class Gateway(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_OPTIONS(self):self.send(200,b'{}',{})
 def send(self,status,body,headers):
  self.send_response(status)
  for k,v in headers.items():
   if k.lower() in ['content-type','content-range','preference-applied','location','cache-control','content-disposition']:self.send_header(k,v)
  self.send_header('Content-Length',str(len(body)));self.send_header('Access-Control-Allow-Origin',APP);self.send_header('Access-Control-Allow-Headers','*');self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');self.end_headers();self.wfile.write(body)
 def handle_req(self):
  route=next(((prefix,svc,port) for prefix,svc,port in [('/auth/v1','reko-pilot-full-auth',9999),('/rest/v1','reko-pilot-full-rest',3000),('/storage/v1','reko-pilot-full-storage',5000),('/local-mail','reko-pilot-full-mail',8025)] if self.path.startswith(prefix+'/')),None)
  if not route:self.send(404,b'{}',{});return
  prefix,svc,port=route
  if prefix=='/storage/v1' and WITHOUT_STORAGE:self.send(503,b'{"message":"Storage is explicitly unavailable in this partial pilot environment"}',{'Content-Type':'application/json'});return
  body=self.rfile.read(int(self.headers.get('content-length','0')))
  if len(body)>20*1024*1024:self.send(413,b'{}',{});return
  headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection','content-length','accept-encoding','origin']}
  try:status,hs,raw=internal(svc,port,self.command,self.path[len(prefix):],body,headers);self.send(status,raw,hs)
  except Exception:self.send(502,b'{"message":"Local pilot service unavailable"}',{'Content-Type':'application/json'})
 do_GET=handle_req;do_POST=handle_req;do_PUT=handle_req;do_PATCH=handle_req;do_DELETE=handle_req

def wait(label,fn):
 for n in range(120):
  try:fn();return
  except Exception:
   if n==119:raise RuntimeError(label+' did not become ready')
   time.sleep(.5)
def setup():
 if not (ROOT/'package.json').is_file():raise RuntimeError('Set REKO_PILOT_SOURCE to the checked-out REKO repository')
 # Validate every existing resource before removing any of them.
 for name in CONTAINERS:
  rows=json.loads(docker('inspect',name,check=False) or '[]')
  if rows and (rows[0].get('Config',{}).get('Labels') or {}).get('reko.pilot')!='fullstack':raise RuntimeError('Refuse unknown existing container '+name)
  if rows and '--reset' not in sys.argv:raise RuntimeError('Pilot resources already exist; stop the active stack, or use explicit --reset for retained failed fixtures')
 rows=json.loads(docker('network','inspect',NET,check=False) or '[]')
 if rows and (rows[0].get('Labels') or {}).get('reko.pilot')!='fullstack':raise RuntimeError('Refuse unknown existing network')
 if rows and '--reset' not in sys.argv:raise RuntimeError('Pilot network already exists; stop active stack or explicitly --reset retained failed fixtures')
 for name in CONTAINERS:docker('rm','-fv',name,check=False)
 docker('network','rm',NET,check=False);docker('network','create','--internal','--label','reko.pilot=fullstack','--label','reko.pilot.run='+RUN_ID,NET)
 run(DB,IMAGES['db'],{'POSTGRES_PASSWORD':PASSWORD,'POSTGRES_DB':'reko_pilot'})
 wait('PostgreSQL',lambda:sql('SELECT 1'))
 sql("""CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '"""+PASSWORD+"""'; GRANT anon,authenticated,service_role TO authenticator;
 CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD '"""+PASSWORD+"""';
 CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
 CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE BYPASSRLS PASSWORD '"""+PASSWORD+"""';
 CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin; GRANT anon,authenticated,service_role TO supabase_storage_admin;
 CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role,supabase_auth_admin,supabase_storage_admin;
 GRANT CREATE ON SCHEMA public TO supabase_storage_admin; GRANT CREATE ON DATABASE reko_pilot TO supabase_storage_admin;
 ALTER DATABASE reko_pilot SET search_path=public,extensions;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;""")
 run('reko-pilot-full-mail',IMAGES['mail'],{'MP_MAX_MESSAGES':'10000','MP_SMTP_AUTH_ACCEPT_ANY':'1','MP_SMTP_AUTH_ALLOW_INSECURE':'1'})
 run('reko-pilot-full-auth',IMAGES['auth'],{'GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','API_EXTERNAL_URL':API+'/auth/v1','GOTRUE_SITE_URL':APP,'GOTRUE_URI_ALLOW_LIST':APP+'/**','GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:{PASSWORD}@{DB}:5432/reko_pilot?search_path=auth','GOTRUE_JWT_SECRET':JWT,'GOTRUE_JWT_EXP':'3600','GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_DISABLE_SIGNUP':'false','GOTRUE_SMTP_HOST':'reko-pilot-full-mail','GOTRUE_SMTP_PORT':'1025','GOTRUE_SMTP_ADMIN_EMAIL':'auth@pilot.invalid','GOTRUE_SMTP_SENDER_NAME':'REKO local pilot','GOTRUE_MAILER_URLPATHS_CONFIRMATION':'/auth/v1/verify','GOTRUE_MAILER_URLPATHS_RECOVERY':'/auth/v1/verify','GOTRUE_MAILER_URLPATHS_INVITE':'/auth/v1/verify','GOTRUE_SECURITY_SMTP_FORWARDED_ENABLED':'true','GOTRUE_RATE_LIMIT_EMAIL_SENT':'10000','GOTRUE_SMTP_MAX_FREQUENCY':'1s'})
 wait('GoTrue',lambda:request('reko-pilot-full-auth','/health'))
 sql("""CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,jsonb_build_object('sub',nullif(current_setting('request.jwt.claim.sub',true),''))) $$;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role; GRANT SELECT ON auth.users TO service_role;""")
 if WITHOUT_STORAGE:
  sql("""CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;""")
 else:
  # Storage migrations own storage schema; do not substitute the unit-test schema.
  run('reko-pilot-full-storage',IMAGES['storage'],{'ANON_KEY':ANON,'SERVICE_KEY':SERVICE,'POSTGREST_URL':'http://reko-pilot-full-rest:3000','PGRST_JWT_SECRET':JWT,'DATABASE_URL':f'postgres://supabase_storage_admin:{PASSWORD}@{DB}:5432/reko_pilot','FILE_SIZE_LIMIT':'10485760','STORAGE_BACKEND':'file','FILE_STORAGE_BACKEND_PATH':'/var/lib/storage','TENANT_ID':'reko-local-pilot','REGION':'local','GLOBAL_S3_BUCKET':'local','ENABLE_IMAGE_TRANSFORMATION':'false','SERVER_PORT':'5000'})
  wait('Storage migrations',lambda:sql('SELECT 1 FROM storage.objects LIMIT 1'))
 for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
  if 'seed_test_data' not in p.name:sql(p.read_text())
 for p in sorted((ROOT/'drizzle/migrations').glob('*.sql')):sql(p.read_text())
 sql('GRANT USAGE ON SCHEMA public,storage TO anon,authenticated,service_role; GRANT ALL ON storage.buckets TO service_role; GRANT ALL ON storage.objects TO authenticated,service_role;')
 run('reko-pilot-full-rest',IMAGES['rest'],{'PGRST_DB_URI':f'postgres://authenticator:{PASSWORD}@{DB}:5432/reko_pilot','PGRST_DB_SCHEMAS':'public,storage','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':JWT})
 accounts=[]
 for role,n in [('admin',1)]+[('school',i) for i in range(1,5)]+[('substitute',i) for i in range(1,6)]:
  email=f'{role}{n}@pilot.invalid';password='Pilot-'+secrets.token_urlsafe(18)+'!';name=f'Pilot {role.title()} {n}'
  u=request('reko-pilot-full-auth','/admin/users','POST',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':name}}, {'Authorization':'Bearer '+SERVICE})
  accounts.append({'role':role,'email':email,'password':password,'name':name,'user_id':u['id']})
 admin=accounts[0]['user_id'];sql(f"INSERT INTO public.user_roles(user_id,role) VALUES('{admin}','admin'); SELECT set_config('request.jwt.claim.sub','{admin}',false); UPDATE public.profiles SET is_test=true,approved=true,background_status='approved',phone='0701234567',street_address='Testgatan 1',postal_code='41111',city='Göteborg',consent_at=now();")
 for n,a in enumerate([a for a in accounts if a['role']=='school'],1):
  a['school_name']=f'Pilot School {n}';a['school_id']=sql(f"SELECT set_config('request.jwt.claim.sub','{admin}',false); INSERT INTO public.schools(name,contact_person,email,phone,street_address,postal_code,city,is_test) VALUES('Pilot School {n}','Fixture Contact','{a['email']}','0701234567','Testgatan 1','41111','Göteborg',true) RETURNING id;").splitlines()[-1];sql(f"INSERT INTO public.school_members(user_id,school_id) VALUES('{a['user_id']}','{a['school_id']}');")
 sql("DO $$ BEGIN IF (SELECT count(*) FROM schools WHERE is_test)<>4 OR (SELECT count(*) FROM profiles WHERE is_test)<>10 THEN RAISE EXCEPTION 'Pilot sandbox fixture assertion failed'; END IF; END $$;")
 manifest={'app_url':APP,'api_url':API,'accounts':accounts,'docker_db':DB,'database':'reko_pilot','source':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'isolation':'internal Docker network; synthetic data only; no external SMTP','auth_ready':True,'storage_ready':not WITHOUT_STORAGE,'storage_mode':'schema-only test double; API unavailable' if WITHOUT_STORAGE else 'real official Storage API'}
 (RUNTIME/'manifest.json').write_text(json.dumps(manifest,indent=2));os.chmod(RUNTIME/'manifest.json',0o600)
 appenv=os.environ.copy()
 for k in list(appenv):
  if k.startswith(('SUPABASE_','VITE_SUPABASE_','LOVABLE_','REKO_')):appenv.pop(k,None)
 appenv.update({'VITE_SUPABASE_URL':API,'SUPABASE_URL':API,'VITE_SUPABASE_PUBLISHABLE_KEY':ANON,'SUPABASE_PUBLISHABLE_KEY':ANON,'SUPABASE_SERVICE_ROLE_KEY':SERVICE,'REKO_EMAIL_SENDER_VERIFIED':'false','REKO_PUBLIC_URL':APP})
 return appenv
if __name__=='__main__':
 app=None;server=None
 try:
  appenv=setup();server=ThreadingHTTPServer(('127.0.0.1',54451),Gateway);threading.Thread(target=server.serve_forever,daemon=True).start()
  app=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5182','--strictPort'],cwd=ROOT,env=appenv,stdout=open(RUNTIME/'app.log','w'),stderr=subprocess.STDOUT,start_new_session=True)
  print('Pilot stack ready: API54451 app5182; real Auth/PostgREST/Mailpit; check manifest storage_ready. Synthetic accounts only.',flush=True)
  while True:time.sleep(1)
 except KeyboardInterrupt:pass
 except Exception as e:
  log=subprocess.run(D+['logs','--tail','20','reko-pilot-full-auth'],env=ENV,capture_output=True,text=True)
  (RUNTIME/'auth-failure.log').write_text(log.stdout+log.stderr)
  print(type(e).__name__+': '+str(e),flush=True);raise
 finally:
  if app:
   try:os.killpg(app.pid,signal.SIGTERM)
   except ProcessLookupError:pass
  if server:server.shutdown()
  for name in ([] if os.environ.get('REKO_PILOT_KEEP_FAILED')=='1' and not app else CONTAINERS):
   rows=json.loads(docker('inspect',name,check=False) or '[]')
   if rows and (rows[0].get('Config',{}).get('Labels') or {}).get('reko.pilot.run')==RUN_ID:docker('rm','-fv',name,check=False)
  rows=json.loads(docker('network','inspect',NET,check=False) or '[]')
  if rows and (rows[0].get('Labels') or {}).get('reko.pilot.run')==RUN_ID and not (os.environ.get('REKO_PILOT_KEEP_FAILED')=='1' and not app):docker('network','rm',NET,check=False)
