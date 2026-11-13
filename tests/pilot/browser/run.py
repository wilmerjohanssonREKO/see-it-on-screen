#!/usr/bin/env python3
"""Isolated browser cohort. Requires real local stack and synthetic fixture manifest."""
import argparse,asyncio,datetime,json,math,os,random,re,subprocess,time,uuid,shutil
import playwright
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from playwright.async_api import async_playwright

HERE=Path(__file__).resolve().parent

def local_url(value):
    u=urlsplit(value)
    if u.scheme!='http' or u.hostname not in ('127.0.0.1','localhost') or not u.port:
        raise ValueError('Only explicit loopback HTTP endpoints are allowed by this pilot harness')
    return value.rstrip('/')

def percentile(values,p):
    if not values:return None
    return round(sorted(values)[max(0,math.ceil(len(values)*p)-1)],2)

class Actor:
    def __init__(self,runner,index,account,kind):
        self.r=runner;self.index=index;self.account=account;self.kind=kind
        self.id=f'{kind}-{index}';self.rng=random.Random(runner.args.seed+index*101)
        self.events=[];self.requests=[];self.page_errors=[];self.dialogs=[];self.started=time.monotonic();self.ctx=None;self.page=None
        self.completed=False;self.completed_at=None;self.current='setup';self.trace_started=False
    async def pause(self,kind='read'):
        lo,hi=self.r.model['think_seconds'][kind];planned=self.rng.uniform(lo,hi)*self.r.args.think_scale
        start=time.monotonic();await asyncio.sleep(planned)
        self.events.append({'kind':'assumed_think','action':kind,'planned_ms':round(planned*1000,2),'duration_ms':round((time.monotonic()-start)*1000,2)})
    async def measure(self,label,operation,kind='system_wait'):
        self.current=label;start=time.monotonic()
        if self.r.args.progress:print(json.dumps({'actor':self.id,'step':label}),flush=True)
        try:
            result=await operation()
            self.events.append({'kind':kind,'action':label,'duration_ms':round((time.monotonic()-start)*1000,2),'passed':True})
            return result
        except Exception:
            self.events.append({'kind':kind,'action':label,'duration_ms':round((time.monotonic()-start)*1000,2),'passed':False})
            raise
    async def click(self,locator,label,think='read'):
        await self.pause(think)
        return await self.measure(label,lambda:locator.click(),kind='click')
    async def fill(self,locator,value,label,think=False):
        if think:await self.pause('write')
        await self.measure(label+'_focus',lambda:locator.click(),kind='click')
        return await self.measure(label,lambda:locator.fill(value),kind='input')
    async def wait(self,locator,label):
        return await self.measure(label,lambda:locator.wait_for(state='visible'))
    async def coordinate(self,event,label):
        return await self.measure(label,lambda:asyncio.wait_for(event.wait(),self.r.model['timeouts_seconds']['coordination']),kind='scenario_coordination')
    async def reload(self):
        await self.pause('navigate')
        return await self.measure('reload',lambda:self.page.reload(wait_until='domcontentloaded'),kind='navigation')
    async def open(self,browser):
        options={'viewport':{'width':390 if self.kind=='substitute' else 1280,'height':950}}
        if self.index<self.r.args.record_users:
            options['record_video_dir']=str(self.r.out/'videos');options['record_video_size']={'width':960,'height':720}
        self.ctx=await browser.new_context(**options)
        self.page=await self.ctx.new_page();self.page.set_default_timeout(self.r.model['timeouts_seconds']['action']*1000)
        self.page.on('pageerror',lambda e:self.page_errors.append(type(e).__name__))
        async def dialog(d):
            self.dialogs.append({'type':d.type,'accepted':True});await d.accept()
        self.page.on('dialog',lambda d:asyncio.create_task(dialog(d)))
        async def route(r):
            u=urlsplit(r.request.url)
            if u.hostname in ('127.0.0.1','localhost') or u.scheme in ('data','blob','about'):await r.continue_()
            else:await r.abort()
        await self.page.route('**/*',route)
        started={};statuses={}
        def onresponse(response):statuses[id(response.request)]=response.status
        self.page.on('response',onresponse)
        def onrequest(req):started[id(req)]=time.monotonic()
        def onfinished(req):
            t=started.pop(id(req),None)
            if t is not None:
                u=urlsplit(req.url)
                self.requests.append({'method':req.method,'path':u.path,'status':statuses.pop(id(req),None),'duration_ms':round((time.monotonic()-t)*1000,2)})
        def onfailed(req):
            t=started.pop(id(req),None);u=urlsplit(req.url)
            self.requests.append({'method':req.method,'path':u.path,'status':None,'failed':True,'aborted':req.failure=='net::ERR_ABORTED','duration_ms':round((time.monotonic()-(t or time.monotonic()))*1000,2)})
        self.page.on('request',onrequest);self.page.on('requestfinished',onfinished);self.page.on('requestfailed',onfailed)
        self.started=time.monotonic()
        await self.measure('open_login',lambda:self.page.goto(self.r.base+'/auth',wait_until='networkidle'),kind='navigation')
        await self.fill(self.page.get_by_label('E-post',exact=True),self.account['email'],'enter_email')
        # Credential contents never appear in JSON events or error messages.
        await self.fill(self.page.get_by_label('Lösenord',exact=True),self.account['password'],'enter_password')
        await self.click(self.page.get_by_role('button',name='Logga in',exact=True),'login','navigate')
        await self.measure('login_destination',lambda:self.page.wait_for_url(lambda u:'/auth' not in u))
        if self.r.args.traces and self.index<self.r.args.record_users:
            await self.ctx.tracing.start(screenshots=True,snapshots=True,sources=False);self.trace_started=True
    async def close(self):
        if self.ctx:
            if self.trace_started:await self.ctx.tracing.stop(path=str(self.r.out/f'{self.id}-trace.zip'))
            await self.ctx.close()
    def complete(self):
        self.completed=True;self.completed_at=time.monotonic()
    def report(self):
        totals={kind:round(sum(e['duration_ms'] for e in self.events if e['kind']==kind),2) for kind in ['assumed_think','click','input','navigation','system_wait','scenario_coordination']}
        return {'actor':self.id,'role':self.kind,'completed':self.completed,'elapsed_ms':round(((self.completed_at or time.monotonic())-self.started)*1000,2),'clicks':sum(e['kind']=='click' for e in self.events),'totals_ms':totals,'events':self.events,'requests':self.requests,'page_errors':self.page_errors,'confirmation_dialogs':len(self.dialogs)}

class Runner:
    def __init__(self,args):
        self.args=args;self.model=json.loads((HERE/'model.json').read_text());self.manifest=json.loads(Path(args.manifest).read_text())
        self.base=local_url(self.manifest['app_url']);local_url(self.manifest['api_url'])
        self.run_id='pilot-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:6]
        self.out=Path(args.output or HERE/'artifacts'/self.run_id);self.out.mkdir(parents=True,exist_ok=False);self.out.chmod(0o700)
        self.actors=[];self.pairs=[];self.errors=[]
    def accounts(self,role):return [a for a in self.manifest['accounts'] if a['role']==role]
    def check_manifest(self):
        if self.args.users<3 or self.args.users>self.model['max_users_per_run']:
            raise ValueError('Stage exceeds configured runner resource cap; inspect saturation and fixture capacity before raising it')
        n=(self.args.users-1)//2
        if len(self.accounts('school'))<n or len(self.accounts('substitute'))<n+(self.args.users%2==0) or not self.accounts('admin'):
            raise ValueError('Not enough unique fixture identities for this stage; provision more rather than reuse accounts')
        for a in self.manifest['accounts']:
            if not a['email'].endswith(('.invalid','@example.test')):raise ValueError('Manifest must contain only synthetic reserved-domain identities')
        if self.args.record_users<0 or self.args.record_users>self.args.users:raise ValueError('Invalid video limit')
        if self.args.think_scale<=0 or self.args.think_scale>2:raise ValueError('Think scale must be >0 and <=2')
        for i in range(n):
            self.pairs.append({'index':i,'marker':f'{self.run_id}-pair{i}','date':(datetime.date.today()+datetime.timedelta(days=3+i)).isoformat(),**{k:asyncio.Event() for k in ['published','applied','selected','requested','resolved']}})
    def actor(self,account,kind):
        a=Actor(self,len(self.actors),account,kind);self.actors.append(a);return a
    async def subcard(self,a,pair,refresh=False):
        if refresh:await a.reload()
        target=a.page.locator('[data-assignment-id]').filter(has_text=pair['marker'])
        # Pagination is explicit UI navigation, never a direct API shortcut.
        for _ in range(max(1,math.ceil(len(self.pairs)/25)+1)):
            try:await target.first.wait_for(timeout=self.model['timeouts_seconds']['action']*1000);return target.first
            except Exception:
                nxt=a.page.get_by_role('button',name='Nästa',exact=True)
                if not await nxt.is_enabled():raise
                await a.click(nxt,'next_assignment_page','navigate')
        raise RuntimeError('Target assignment absent from bounded list pages')
    def schoolcard(self,a,pair):return a.page.locator('div.rounded-panel.border.bg-card').filter(has_text=pair['date']).filter(has_text='Matematik')
    async def school(self,a,pair,browser):
        await a.open(browser);await a.wait(a.page.get_by_role('heading',name=a.account['school_name'],exact=True),'school_identity')
        await a.click(a.page.get_by_role('combobox').first,'choose_subject')
        await a.click(a.page.get_by_role('option',name='Matematik',exact=True),'subject_mathematics','navigate')
        await a.fill(a.page.locator('input[name=date]'),pair['date'],'assignment_date')
        await a.fill(a.page.locator('input[name=start]'),'09:00','start_time')
        await a.fill(a.page.locator('input[name=end]'),'11:00','end_time')
        await a.fill(a.page.locator('textarea[name=description]'),pair['marker'],'description',think=True)
        await a.click(a.page.get_by_role('button',name='Publicera vikariebehov',exact=True),'publish')
        card=self.schoolcard(a,pair)
        await a.wait(card.get_by_role('button',name='Visa intresseanmälningar (0)',exact=True),'published_card')
        if await card.count()!=1:raise AssertionError('reset_required_duplicate_school_cards')
        pair['published'].set()
        await a.coordinate(pair['applied'],'wait_for_applicant')
        await a.reload();card=self.schoolcard(a,pair)
        await a.click(card.get_by_role('button',name='Visa intresseanmälningar (1)',exact=True),'review_applicants')
        await a.click(card.get_by_role('button',name='Välj vikarie',exact=True),'select_substitute')
        await a.wait(card.get_by_text('Vikarie:',exact=False),'selected_person_visible');pair['selected'].set()
        await a.coordinate(pair['resolved'],'wait_for_admin_resolution')
        await a.reload();card=self.schoolcard(a,pair)
        await a.wait(card.get_by_role('button',name='Visa intresseanmälningar (0)',exact=True),'reopened_without_assignee')
        a.complete()
    async def substitute(self,a,pair,browser):
        await a.open(browser);await a.coordinate(pair['published'],'wait_for_school_publication')
        card=await self.subcard(a,pair,refresh=True)
        await a.click(card.get_by_role('button',name='Anmäl intresse',exact=True),'apply')
        await a.wait(card.get_by_role('button',name='Återkalla intresse',exact=True),'applied_state')
        await a.click(card.get_by_role('button',name='Återkalla intresse',exact=True),'withdraw_application')
        await a.wait(card.get_by_role('button',name='Anmäl intresse',exact=True),'withdrawn_state')
        await a.click(card.get_by_role('button',name='Anmäl intresse',exact=True),'reapply')
        await a.wait(card.get_by_role('button',name='Återkalla intresse',exact=True),'reapplied_state');pair['applied'].set()
        await a.coordinate(pair['selected'],'wait_for_school_selection')
        card=await self.subcard(a,pair,refresh=True)
        await a.wait(card.get_by_text('Du är tilldelad detta uppdrag.',exact=True),'allocation_visible')
        await a.wait(card.get_by_text('Kontakt:',exact=False),'permitted_contacts_visible')
        if await a.page.evaluate('document.documentElement.scrollWidth>innerWidth'):raise AssertionError('mobile_overflow')
        await a.click(card.get_by_role('button',name='Begär avbokning',exact=True),'request_cancellation')
        await a.fill(card.get_by_label('Varför behöver uppdraget avbokas?',exact=True),pair['marker']+' cancellation','cancellation_reason',think=True)
        await a.click(card.get_by_role('button',name='Skicka begäran',exact=True),'send_cancellation')
        await a.wait(card.get_by_text('Avbokning begärd',exact=False),'pending_admin_decision');pair['requested'].set()
        await a.coordinate(pair['resolved'],'wait_for_cancellation_decision')
        card=await self.subcard(a,pair,refresh=True)
        await a.wait(card.get_by_role('button',name='Anmäl intresse',exact=True),'can_reapply_after_cancellation')
        a.complete()
    async def admin(self,a,browser):
        await a.open(browser);await a.wait(a.page.get_by_role('heading',name='Adminpanel',exact=True),'admin_identity')
        for pair in self.pairs:
            await a.coordinate(pair['requested'],'wait_for_cancellation_request')
            await a.reload()
            entry=a.page.locator('div.rounded-panel.border.p-4').filter(has=a.page.get_by_text(pair['marker']+' cancellation',exact=True)).first
            await a.click(entry.get_by_role('button',name='Godkänn avbokning',exact=True),'approve_cancellation')
            await a.wait(entry.get_by_text('Godkänd',exact=True),'approved_state');pair['resolved'].set()
        await a.click(a.page.get_by_role('tab',name='Data',exact=True),'open_data_tab')
        button=a.page.get_by_role('button',name='Bearbeta väntande utskick',exact=True)
        for _ in range(math.ceil(4*len(self.pairs)/10)+2):
            await a.click(button,'capture_queued_test_messages')
            await a.wait(a.page.get_by_text('Fångat testmejl',exact=True).first,'captured_notice_visible')
            await asyncio.sleep(.25)
            if self.manifest.get('docker_db'):
                snapshot=await asyncio.to_thread(self.integrity)
                if snapshot['pending']==0:break
        a.complete()
    async def spectator(self,a,browser):
        await a.open(browser)
        for _ in range(3):
            await a.pause('read');await a.reload()
        await a.measure('navigate_to_forbidden_admin',lambda:a.page.goto(self.base+'/admin',wait_until='domcontentloaded'),kind='navigation')
        await a.wait(a.page.get_by_role('heading',name='Endast för REKO UF-teamet',exact=True),'admin_access_denied')
        a.complete()
    def integrity(self):
        container=self.manifest.get('docker_db')
        if not container or not re.fullmatch(r'reko-pilot-[a-z0-9-]+',container):raise ValueError('Integrity checks require a dedicated reko-pilot-* local DB container')
        db=self.manifest.get('database','postgres')
        if not re.fullmatch(r'[a-zA-Z0-9_]+',db):raise ValueError('Invalid local database name')
        marker=self.run_id.replace("'","''")
        sql=f"""SELECT json_build_object(
          'assignments',(SELECT count(*) FROM public.assignments WHERE description LIKE '{marker}%'),
          'open',(SELECT count(*) FROM public.assignments WHERE description LIKE '{marker}%' AND status='open' AND assigned_substitute_id IS NULL),
          'approved_cancellations',(SELECT count(*) FROM public.cancellation_requests c JOIN public.assignments a ON a.id=c.assignment_id WHERE a.description LIKE '{marker}%' AND c.status='approved'),
          'unsafe_fixtures',(SELECT count(*) FROM public.assignments a JOIN public.schools s ON s.id=a.school_id WHERE a.description LIKE '{marker}%' AND NOT s.is_test),
          'overlapping_allocations',(SELECT count(*) FROM public.assignments a JOIN public.assignments b ON a.id<b.id AND a.assigned_substitute_id=b.assigned_substitute_id AND a.assignment_date=b.assignment_date AND a.start_time<b.end_time AND a.end_time>b.start_time WHERE a.status='filled' AND b.status='filled'),
          'run_outbox',(SELECT count(*) FROM public.email_outbox e JOIN public.assignments a ON a.id=e.assignment_id WHERE a.description LIKE '{marker}%'),
          'run_captured',(SELECT count(*) FROM public.email_outbox e JOIN public.assignments a ON a.id=e.assignment_id WHERE a.description LIKE '{marker}%' AND e.status='captured'),
          'run_cancelled',(SELECT count(*) FROM public.email_outbox e JOIN public.assignments a ON a.id=e.assignment_id WHERE a.description LIKE '{marker}%' AND e.status='cancelled' AND e.template IN ('uppdrag-tilldelat','vikarie-tilldelad')),
          'run_unexpected_notice_state',(SELECT count(*) FROM public.email_outbox e JOIN public.assignments a ON a.id=e.assignment_id WHERE a.description LIKE '{marker}%' AND NOT ((e.status='captured' AND e.template='uppdrag-avbokat') OR (e.status='cancelled' AND e.template IN ('uppdrag-tilldelat','vikarie-tilldelad')))),
          'external_sent',(SELECT count(*) FROM public.email_outbox WHERE status='sent'),
          'pending',(SELECT count(*) FROM public.email_outbox WHERE status IN ('pending','sending','retry','failed')),
          'captured',(SELECT count(*) FROM public.email_outbox WHERE status='captured'));
        """
        env=os.environ.copy()
        for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
        proc=subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=sql,text=True,env=env,capture_output=True,timeout=20)
        if proc.returncode:raise RuntimeError('local_integrity_query_failed')
        return json.loads(proc.stdout)
    def fixture_preflight(self):
        container=self.manifest.get('docker_db');database=self.manifest.get('database')
        if container!='reko-pilot-full-db' or database!='reko_pilot':raise ValueError('Dedicated local stack required')
        env=os.environ.copy()
        for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
        cmd=['docker','--host=unix:///var/run/docker.sock']
        labels=json.loads(subprocess.check_output(cmd+['inspect','--format','{{json .Config.Labels}}',container],env=env,text=True))
        if labels.get('reko.pilot')!='fullstack' or not re.fullmatch(r'[a-f0-9]{16}',labels.get('reko.pilot.run','')):raise ValueError('Local pilot owner labels required')
        ids=lambda values:','.join("'"+str(uuid.UUID(value))+"'::uuid" for value in values)
        users=ids([a['user_id'] for a in self.manifest['accounts']]);subs=ids([a['user_id'] for a in self.accounts('substitute')]);schools=ids([a['school_id'] for a in self.accounts('school')])
        members=' OR '.join("(user_id='"+str(uuid.UUID(a['user_id']))+"' AND school_id='"+str(uuid.UUID(a['school_id']))+"')" for a in self.accounts('school'))
        admin=str(uuid.UUID(self.accounts('admin')[0]['user_id']))
        sql=f"""SELECT json_build_object('missing_profiles',{len(self.manifest['accounts'])}-(SELECT count(*) FROM public.profiles WHERE id IN ({users})),
        'unsafe_profiles',(SELECT count(*) FROM public.profiles WHERE id IN ({users}) AND is_test IS DISTINCT FROM true),
        'unapproved_substitutes',(SELECT count(*) FROM public.profiles WHERE id IN ({subs}) AND (NOT approved OR background_status<>'approved')),
        'missing_schools',{len(self.accounts('school'))}-(SELECT count(*) FROM public.schools WHERE id IN ({schools})),
        'unsafe_schools',(SELECT count(*) FROM public.schools WHERE id IN ({schools}) AND is_test IS DISTINCT FROM true),
        'missing_memberships',{len(self.accounts('school'))}-(SELECT count(*) FROM public.school_members WHERE {members}),
        'missing_admin',1-(SELECT count(*) FROM public.user_roles WHERE user_id='{admin}' AND role='admin'))"""
        proc=subprocess.run(cmd+['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],env=env,input=sql,capture_output=True,text=True,timeout=20)
        if proc.returncode:raise RuntimeError('Fixture preflight query failed')
        result=json.loads(proc.stdout)
        (self.out/'fixture-preflight.json').write_text(json.dumps(result,indent=2))
        if any(result.values()):raise ValueError('Pilot fixture preflight failed before navigation')
    async def readiness(self):
        deadline=time.monotonic()+60
        while time.monotonic()<deadline:
            try:
                def probe():
                    for url in [self.base+'/auth',local_url(self.manifest['api_url'])+'/auth/v1/health']:
                        with urlopen(url,timeout=3) as response:
                            if response.status!=200:raise RuntimeError('local_service_not_ready')
                await asyncio.to_thread(probe);return
            except Exception:await asyncio.sleep(1)
        raise TimeoutError('local_stack_readiness_timeout')
    async def execute(self):
        self.check_manifest();await asyncio.to_thread(self.fixture_preflight);await self.readiness();start=time.monotonic();integrity=None
        if self.args.record_users:
            ffmpeg=shutil.which('ffmpeg')
            if not ffmpeg:raise RuntimeError('system_ffmpeg_required_for_video')
            browsers=json.loads((Path(playwright.__file__).parent/'driver/package/browsers.json').read_text())['browsers']
            revision=next(b['revision'] for b in browsers if b['name']=='ffmpeg')
            runtime=self.out/'playwright-runtime';target=runtime/f'ffmpeg-{revision}'/'ffmpeg-linux'
            target.parent.mkdir(parents=True,exist_ok=True);target.symlink_to(ffmpeg)
            os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(runtime)
        async with async_playwright() as p:
            browser=await p.chromium.launch(executable_path=self.args.chromium,headless=True,args=['--no-sandbox'])
            tasks=[]
            for i,pair in enumerate(self.pairs):
                tasks.append(asyncio.create_task(self.school(self.actor(self.accounts('school')[i],'school'),pair,browser)))
                tasks.append(asyncio.create_task(self.substitute(self.actor(self.accounts('substitute')[i],'substitute'),pair,browser)))
            tasks.append(asyncio.create_task(self.admin(self.actor(self.accounts('admin')[0],'admin'),browser)))
            if self.args.users%2==0:tasks.append(asyncio.create_task(self.spectator(self.actor(self.accounts('substitute')[-1],'spectator'),browser)))
            try:
                done,pending=await asyncio.wait(tasks,timeout=self.model['timeouts_seconds']['stage'],return_when=asyncio.FIRST_EXCEPTION)
                for task in done:
                    if task.exception():raise task.exception()
                if pending:raise TimeoutError('Stage time budget exceeded')
                integrity=await asyncio.to_thread(self.integrity)
                if integrity['assignments']!=len(self.pairs) or integrity['open']!=len(self.pairs) or integrity['approved_cancellations']!=len(self.pairs) or integrity['run_outbox']!=4*len(self.pairs) or integrity['run_captured']!=2*len(self.pairs) or integrity['run_cancelled']!=2*len(self.pairs) or integrity['run_unexpected_notice_state'] or integrity['unsafe_fixtures'] or integrity['overlapping_allocations'] or integrity['external_sent'] or integrity['pending']:
                    raise AssertionError('integrity_gate_failed')
            except Exception as e:
                # Never serialize exception messages from credential-bearing Playwright calls.
                self.errors.append({'type':type(e).__name__,'unfinished':[{'actor':a.id,'step':a.current} for a in self.actors if not a.completed]})
            finally:
                for task in tasks:
                    if not task.done():task.cancel()
                await asyncio.gather(*tasks,return_exceptions=True)
                reports=[a.report() for a in self.actors]
                for a in self.actors:
                    if not a.completed and a.page:
                        try:await a.page.screenshot(path=str(self.out/f'{a.id}-failure.png'),full_page=True)
                        except Exception:pass
                    try:await a.close()
                    except Exception:self.errors.append({'type':'artifact_close_failed','actor':a.id})
                await browser.close()
        all_events=[e for a in reports for e in a['events']]
        system=[e['duration_ms'] for e in all_events if e['kind']=='system_wait']
        api_requests=[q for a in reports for q in a['requests'] if q['path'].startswith(('/rest/v1/','/auth/v1/','/storage/v1/'))]
        page_errors=sum(len(a['page_errors']) for a in reports)
        api_errors=sum((q.get('failed',False) and not q.get('aborted',False)) or (q.get('status') is not None and q['status']>=400) for q in api_requests)
        passed=not self.errors and not page_errors and not api_errors and all(a['completed'] for a in reports)
        result={'run_id':self.run_id,'source_commit':self.manifest.get('source_commit',self.manifest.get('source','unspecified')),'model':self.model,'model_version':self.model['version'],'seed':self.args.seed,'users':self.args.users,'max_simultaneous_contexts':len(self.actors),'human_timing_scale':self.args.think_scale,'think_times_are_assumptions':True,'duration_ms':round((time.monotonic()-start)*1000,2),'passed':passed,'completed_users':sum(a['completed'] for a in reports),'clicks':sum(a['clicks'] for a in reports),'system_wait_p50_ms':percentile(system,.5),'system_wait_p95_ms':percentile(system,.95),'page_errors':page_errors,'api_requests':len(api_requests),'api_http_errors':api_errors,'api_request_p95_ms':percentile([q['duration_ms'] for q in api_requests],.95),'errors':self.errors,'integrity':integrity,'actors':reports,'limitations':['Local isolated deployment; not a production-capacity measurement','Simulated think times need validation with real people','Coordination waits are test orchestration, not system response time','Initial model does not cover real onboarding, recovery, Storage, long-duration reliability or provider delivery']}
        (self.out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in result.items() if k!='actors'},ensure_ascii=False))
        return 0 if passed else 1

async def main():
    p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--users',type=int,default=5);p.add_argument('--seed',type=int,default=20261113);p.add_argument('--think-scale',type=float,default=1);p.add_argument('--record-users',type=int,default=2);p.add_argument('--traces',action='store_true');p.add_argument('--chromium',default='/usr/bin/chromium');p.add_argument('--output');p.add_argument('--progress',action='store_true')
    args=p.parse_args()
    try:return await Runner(args).execute()
    except Exception as e:
        print(json.dumps({'passed':False,'setup_error':type(e).__name__}));return 2
if __name__=='__main__':raise SystemExit(asyncio.run(main()))
