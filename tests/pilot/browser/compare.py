#!/usr/bin/env python3
"""Compare completed local cohorts; never interprets assumed pauses as API latency."""
import argparse,json,statistics
from pathlib import Path
ACTIONS=[('Publicera uppdrag','publish','published_card'),('Välj vikarie','select_substitute','selected_person_visible'),('Begär avbokning','send_cancellation','pending_admin_decision'),('Godkänn avbokning','approve_cancellation','approved_state')]
def values(r,click,visible):
 samples=[]
 for actor in r['actors']:
  events=actor['events']
  for i,event in enumerate(events):
   if event.get('action')!=click or not event.get('passed'):continue
   for next_event in events[i+1:]:
    if next_event.get('action')==click:break
    if next_event.get('action')==visible and next_event.get('passed'):
     samples.append(event['duration_ms']+next_event['duration_ms']);break
 return samples
def render(results):
 lines=['# Jämförelse av lokala pilotprov','','| Användare | Slutförda | DOM-klick | Hela körningen, s | API-anrop | API-fel | API p95, ms |','| ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
 for r in results:
  lines.append(f"| {r['users']} | {r['completed_users']} | {r['clicks']} | {r['duration_ms']/1000:.1f} | {r['api_requests']} | {r['api_http_errors']} | {r['api_request_p95_ms']} |")
 lines+=['','Körningstid inkluderar antagna pauser och samordning mellan roller. API p95 mäter lokala webbläsarförfrågningar genom Docker-bryggan, inte driftens servicenivå.','', '| Användare | UI-åtgärd | Antal prov | Median, s | Längsta prov, s |','| ---: | --- | ---: | ---: | ---: |']
 for r in results:
  for label,click,visible in ACTIONS:
   samples=values(r,click,visible)
   if samples:lines.append(f"| {r['users']} | {label} | {len(samples)} | {statistics.median(samples)/1000:.2f} | {max(samples)/1000:.2f} |")
 lines+=['','UI-åtgärd räknas som uppmätt klicktid plus efterföljande väntan på det förväntade synliga resultatet. Föregående antagna läs-/skrivpauser och väntan på andra roller ingår inte. Antalet prov är litet; median och max är beskrivande stickprov, inte kapacitetslöften.','', 'Endast slutförda, granskade lokala körningar ska användas. Storage ingår inte i dessa bokningskohorter.']
 return '\n'.join(lines)+'\n'
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('results',nargs='+');p.add_argument('--output',required=True);a=p.parse_args()
 rs=[json.loads(Path(x).read_text()) for x in a.results]
 if not all(r['passed'] for r in rs):raise SystemExit('Refuse comparison containing a failed cohort; report failures separately')
 Path(a.output).write_text(render(rs))
