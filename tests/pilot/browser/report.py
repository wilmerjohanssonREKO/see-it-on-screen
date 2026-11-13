#!/usr/bin/env python3
"""Generate a shareable, synthetic-only Swedish summary from one pilot JSON result."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('result');p.add_argument('--output');a=p.parse_args()
r=json.loads(Path(a.result).read_text());sec=lambda ms:f'{ms/1000:.1f}'
lines=[f"# Pilotprov: {r['run_id']}",'',f"Status: **{'PASSERAT' if r['passed'] else 'INTE GODKÄNT'}**. {r['completed_users']}/{r['users']} användare slutförde sina arbetsuppgifter, med {r['clicks']} skriptade DOM-klick.",f"Kodversion: `{r.get('source_commit','unspecified')}`. Modellversion {r['model_version']}, testfrö {r['seed']}, tänketidsfaktor {r['human_timing_scale']}.",'','| Roll | Slutförd | Klick | Uppgiftstid, s | Antagen tänketid, s | Samordningsväntan, s |','| --- | --- | ---: | ---: | ---: | ---: |']
for x in r['actors']:
 lines.append(f"| {x['actor']} | {'Ja' if x['completed'] else 'Nej'} | {x['clicks']} | {sec(x['elapsed_ms'])} | {sec(x['totals_ms']['assumed_think'])} | {sec(x['totals_ms']['scenario_coordination'])} |")
lines+=['','Uppgiftstid mäts från öppnad inloggning till respektive användares färdiga uppgift. Den inkluderar antagna läs-/skrivpauser och väntan på andra roller. Samordningsväntan organiseras av testet och är inte systemets svarstid. Native bekräftelser redovisas separat i JSON; de ingår inte i DOM-klickantalet.','',f"JavaScript-sidfel: {r['page_errors']}. Den sammanlagda körningen tog {sec(r['duration_ms'])} sekunder inklusive avslutning av webbläsare och inspelning.",'','## Databaskontroll','', '```json',json.dumps(r.get('integrity'),indent=2,ensure_ascii=False),'```','','## Tolkning','','Detta är en lokal isolerad körning med syntetiska konton. Ett godkänt prov visar att de valda flödena klarades i den miljön. Det verifierar inte produktionskapacitet eller hur fort verkliga människor genomför uppgifterna. Inbjudningar, återställning, privat filhantering och extern leverans kräver separata integrationsprov.']
if r['errors']:lines+=['','Fel/stopp:','', '```json',json.dumps(r['errors'],indent=2,ensure_ascii=False),'```']
text='\n'.join(lines)+'\n'
if a.output:Path(a.output).write_text(text)
else:print(text)
