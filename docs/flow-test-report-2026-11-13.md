# REKO: utökad flödesgranskning 2026-11-13

## Status och avgränsning

Granskningen utgår från Lovable/GitHub-version `96d0005228927c1833632aaf32a128eae0c33b0c`. Föreslagna rättningar ligger på `codex/reko-pilot-readiness`. Denna rapport innebär ingen driftsättning, databasändring i Lovable eller publicering.

Testerna använder isolerad lokal PostgreSQL 17, syntetiska konton och testmeddelanden. REKO:s befintliga konton och uppdrag används inte för skrivtester. Resultaten är funktionella bevis inom angiven testmiljö, inte en fullständig säkerhetscertifiering eller kapacitetsmätning.

## Upptäckta problem och föreslagna rättningar

### Hög prioritet: avbokningsorsaker kunde läsas av fel person

`my_cancellation_requests()` härledde tidigare bokningsrelation från en återkallad intresseanmälan. En vikarie som aldrig valts, eller som deltagit i en tidigare tilldelning, kunde därför läsa en senare avbokningsorsak. Direkt tabellåtkomst och RPC behövde samma uttryckliga partsmodell.

Migrering `0023_flow_regressions.sql` sparar den faktiskt berörda vikarien på avbokningsbegäran och begränsar både RLS och RPC till rätt parter. Pågående äldre begäranden får aktuell tilldelning som underlag; avslutad historik får ingen gissad mottagare. Detta kan innebära att en vikarie inte ser en äldre avslutad begäran där korrekt historisk part inte kan bevisas. REKO och behörig skola behåller sin åtkomst.

Rättningen ska genomföras före en bredare pilot. Regressionerna täcker aldrig vald sökande, tidigare vald vikarie, senare ersättare och åtkomst till den egna avbokningen.

### Hög prioritet: skydda formuläret före JavaScript-start

Inloggningsformuläret saknade explicit HTTP-metod. Webbläsarens standard är GET, vilket innebär risk att formulärfält hamnar i URL vid inbyggd formulärinlämning före hydrering. Föreslagen rättning sätter POST och håller skicka-knappen avstängd tills React har kopplat på händelsehanteringen. Kontroll med JavaScript avstängt visar POST och avstängd knapp. Ingen riktig användares lösenord användes i testet och detta är inget påstående om att riktiga uppgifter har läckt.

### Medelprioritet: dubblerad intressestatistik

Upprepad `apply_assignment()` gav en enda ansökningsrad men flera `application_submitted`-händelser. Rättningen loggar endast när en ny ansökan skapas eller en återkallad ansökan faktiskt återaktiveras. Upprepade anrop behåller samma svar utan att öka statistiken.

### Låg prioritet: avbokningens textlängd

Formuläret tillät 1 000 tecken medan databasen accepterade 500. Gränsen i formuläret ändras till 500 så användaren inte kan skriva en text som servern sedan avvisar av längdskäl.

## Verifiering

- 35 av 35 utökade SQL-scenarier passerar med rättningen. `tests/extended-flows.sql` körs automatiskt av `bash scripts/test-db.sh` och avbryter vid fel.
- Hela befintliga lokala migrations-, RLS-, inbjudnings-, outbox- och bokningssviten passerar. Samtidiga överlappande val ger exakt en tilldelning och två varaktiga bekräftelsejobb.
- 26 av 26 enhetstester passerar. TypeScript-kontroll och produktionsbygge passerar.
- SSR-kontrollen med JavaScript avstängt passerar; se `test-evidence/auth-ssr-check.json`.
- En mindre SQL-simulering på den tidigare versionen passerade med fem skolor, 20 vikarier, 50 uppdrag och 250 intresseanmälningar. 120 meddelanden fångades och inga skickades externt. Se `test-evidence/sql-mini-simulation.json`. Den simuleringen ersätter inte de nya integritetsregressionerna.

19 av 19 webbläsarkontroller passerar: skolans publicering och val, vikariens intresse/återkallande/återanmälan, tilldelade kontaktuppgifter, mobilvy, avslag och godkännande av avbokning, återöppning, fångade meddelanden, API-fel/återförsök och spärr mot adminvyn. Inga JavaScript-sidfel registrerades; fyra meddelanden fångades och noll skickades externt. Se `test-evidence/browser-flows.json`. Auth-leverantören simuleras där med signerade fixture-token; PostgREST, databas, RLS och appens UI/RPC är riktiga. Resultaten ska inte beskrivas som verifierad extern Supabase Auth eller e-postleverans.

## Återstående verifiering och driftkrav

Riktig inbjudnings- och återställningsmejl, Auth-verifiering, privata Storage-uppladdningar och signerade länkars utgångstid behöver provas i en separat fullständig miljö. E-postavsändare, exakta DNS-poster, hemligheter i hosting och automatisk schemaläggning behöver konfigureras och verifieras innan externa utskick aktiveras. Testerna här ändrar inga DNS-poster eller driftinställningar.

Genomför även återställningsprov från backup och felprov för delvis genomförd kontoradering. Bestäm lagringstid och ansvar innan automatisk gallring införs.

## Rekommenderad ordning

1. Granska och inför rättningarna inklusive migrering 0023 i en kontrollerad driftsättning enligt `docs/rollout.md`. Bevara befintliga konton och historik.
2. Sätt upp separat pilotmiljö med riktig Auth, Storage och isolerad e-postfångst.
3. Kör den utökade automatiserade piloten och därefter deltagarpass. Fastställ belastnings- och leveransmål innan kapaciteten godkänns.

Se [pilotplanen](pilot-plan.md) för omfattning, mätning och de beslut REKO behöver ta.
