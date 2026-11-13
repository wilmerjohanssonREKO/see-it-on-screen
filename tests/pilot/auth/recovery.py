#!/usr/bin/env python3
"""Real local GoTrue SMTP + app password recovery; synthetic identity only."""
import argparse,asyncio,json,re,secrets,time,html
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
async def main(args):
 m=json.loads(Path(args.manifest).read_text());api=m['api_url'];app=m['app_url']
 assert all(urlsplit(v).hostname=='127.0.0.1' for v in (api,app))
 email='recovery-'+secrets.token_hex(5)+'@pilot.invalid';old='Pilot-'+secrets.token_urlsafe(20);new='Pilot-'+secrets.token_urlsafe(20);checks=[]
 async with async_playwright() as p:
  req=await p.request.new_context()
  r=await req.post(api+'/auth/v1/signup',data={'email':email,'password':old});assert r.ok
  r=await req.post(api+'/auth/v1/token?grant_type=password',data={'email':email,'password':old});assert not r.ok;checks.append('unverified signup cannot log in')
  async def link(kind):
   for _ in range(60):
    r=await req.get(api+'/local-mail/api/v1/messages');data=await r.json()
    for item in data.get('messages',[]):
     if not any(x.get('Address')==email for x in item.get('To',[])):continue
     d=await (await req.get(api+'/local-mail/api/v1/message/'+item['ID'])).json()
     for v in re.findall(r'https?://[^\s<>"\']+',html.unescape(d.get('Text','')+' '+d.get('HTML',''))):
      if '/verify?' in v and ('type='+kind) in v:return v
    await asyncio.sleep(.2)
   raise AssertionError('mail_capture_link_timeout')
  confirmation=await link('signup');assert urlsplit(confirmation).hostname=='127.0.0.1'
  r=await req.get(confirmation,max_redirects=0);assert r.status in (302,303);assert 'access_token=' in r.headers['location'];checks.append('real SMTP confirmation link verifies signup')
  r=await req.post(api+'/auth/v1/token?grant_type=password',data={'email':email,'password':old});assert r.ok;checks.append('verified account can log in')
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=await browser.new_context();page=await ctx.new_page()
  async def route(r):
   if urlsplit(r.request.url).hostname in ('127.0.0.1','localhost'):await r.continue_()
   else:await r.abort()
  await page.route('**/*',route)
  await page.goto(app+'/auth',wait_until='networkidle')
  await page.get_by_role('button',name='Glömt lösenord?',exact=True).click()
  await page.get_by_label('E-post',exact=True).fill(email)
  await page.get_by_role('button',name='Skicka återställningslänk',exact=True).click()
  recovery=await link('recovery');assert urlsplit(recovery).hostname=='127.0.0.1';checks.append('app recovery form sends real internally captured SMTP mail')
  await page.goto(recovery,wait_until='networkidle')
  await page.get_by_label('Nytt lösenord',exact=True).fill(new)
  await page.get_by_label('Bekräfta lösenord',exact=True).fill(new)
  await page.get_by_role('button',name='Spara nytt lösenord',exact=True).click()
  await page.get_by_text('Lösenordet är uppdaterat. Logga in med ditt nya lösenord.',exact=True).wait_for();checks.append('app accepts recovery session and saves replacement password')
  r=await req.post(api+'/auth/v1/token?grant_type=password',data={'email':email,'password':old});assert not r.ok
  r=await req.post(api+'/auth/v1/token?grant_type=password',data={'email':email,'password':new});assert r.ok;checks.append('old password rejected and new password accepted')
  await browser.close();await req.dispose()
 result={'passed':True,'checks':checks,'external_mail':False,'scope':'real local GoTrue, internal SMTP capture and application recovery UI; synthetic identity only'}
 Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 try:asyncio.run(main(a))
 except Exception as e:
  Path(a.output).write_text(json.dumps({'passed':False,'error_type':type(e).__name__}));print(json.dumps({'passed':False,'error_type':type(e).__name__}));raise SystemExit(1)
