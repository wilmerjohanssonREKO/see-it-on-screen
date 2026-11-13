# REKO: rapport över genomförda ändringar den 12 november 2026

Rapport sammanställd den 13 november utifrån kod, driftsättningsstatus och sparade verifieringar. Den omfattar gårdagens ändringar; nya rättningar från dagens utökade tester redovisas separat.

## Levererad version

[PR #1](https://github.com/wilmerjohanssonREKO/see-it-on-screen/pull/1) slogs ihop med `main` efter REKO:s uttryckliga godkännande. Levererad version är `96d0005228927c1833632aaf32a128eae0c33b0c` och Lovables förhandsvisning verifierades som redo på den versionen. Webbplatsen publicerades inte genom detta arbete.

Databasmigreringarna 0019–0022 infördes och registrerades i migreringshistoriken. Befintliga sju profiler, en skola och ett tilldelat uppdrag bevarades; före/efter-kontroll av de befintliga posterna visade oförändrat innehåll. De ursprungliga testkontonas lösenord och testmarkeringar ändrades inte.

## Vad som ändrades och varför

| Område | Genomförd ändring | Praktisk effekt |
| --- | --- | --- |
| Grafisk enhetlighet | Egen gemensam hörnradie på 6 px för textfält, textytor och valfält. Menyer följer panelernas radie. | Fält där användaren skriver uppgifter följer samma formspråk som boxar och knappar. Befintligt Montserrat och 6 px på boxar/knappar behölls. |
| Inloggning och kontobyte | Gemensam rollstyrd navigering, lösenordsåterställning och rensning av privata cachade data när användaridentiteten ändras. | Rätt konto hamnar i rätt vy och data från föregående inloggning ska inte återanvändas. |
| Skol- och lärarkonton | Personliga inbjudningar kopplade till exakt verifierad e-postadress, eget lösenord, 48 timmars giltighet och engångsanvändning. Token lagras hashad. Gemensam skolkod som publik registreringsväg pensionerades. | Skolmedlemskap bygger på en kontrollerad inbjudan. Befintliga medlemskap behölls. |
| Matchning | Vikarie anmäler intresse och skolan väljer bland sökande. Äldre direktbokningsfunktion registrerar nu intresse. | En intresseanmälan tilldelar inte automatiskt uppdraget. Skolan styr valet. |
| Bokningssäkerhet | Databasen kontrollerar framtida tider, godkännande, sandbox och överlapp under låsning/transaktion. | Två samtidiga val kan inte ge samma vikarie överlappande bokningar. |
| Avbokning | Part begär avbokning; REKO godkänner eller avslår. Vikariens godkända avbokning kan öppna framtida uppdrag igen, medan skolans avbokning avslutar behovet. | Bokningen gäller i väntan på beslut och gammal genomförd historik ska inte öppnas igen. |
| Meddelanden | Varaktig transaktionell e-postkö med versionsnycklar, worker-lås, återförsök och adminvy. Skyddad cron-endpoint tillagd. | Ett bokningsbeslut och dess meddelandejobb sparas tillsammans. Leverans är inte beroende av att webbläsaren fortsätter köra. |
| Testisolering | Mottagare och testmarkeringar kontrolleras före leverans; testmeddelanden fångas internt. | Testflöden ska inte skicka meddelanden till riktiga mottagare. De gamla kontona med testnamn räknas inte automatiskt som sandbox. |
| Privata filer och radering | Behörighetskontroll vid signering av CV/profilbilder samt återupptagbar kontoradering med bevarad uppdragshistorik. | Åtkomst följer aktuell relation och misslyckad radering kan återupptas utan att gammal historik återpubliceras. |
| Effektivitet och överblick | Index, sidindelning, samlade profilbildsanrop och minskad dubbelloggning av uppdragsvisningar. | Begränsade läsmängder och färre upprepade anrop. Ingen kvantifierad prestandaförbättring utlovas utan belastningsmätning. |
| Kvalitetskontroll | Automatiska GitHub-kontroller, lokala SQL-sviter, hjälpfunktionstester och driftinstruktioner. | Ändringar kan kontrolleras reproducerbart före nästa leverans. |

## Vad som kontrollerades igår

- 26 enhetstester samt produktionsbygge och TypeScript-kontroll passerade.
- Lokal PostgreSQL körde schema och migreringar samt tester för RLS, inbjudningar, bokningar, avbokningar, outbox, radering och samtidiga överlappande val.
- GitHub-kontrollerna för PR #1 och sammanslagen `main` passerade.
- Inloggning och läsning med de ursprungliga skol- och vikariekontona verifierades via API; därefter avslutades testsessionerna. Inga uppdrag skapades eller ändrades med dessa konton.
- E-postbekräftelse var aktiverad i den offentligt läsbara Auth-konfigurationen. Samtliga 21 publika apptabeller hade RLS aktiverat. Detta är konfigurationskontroller, inte ett bevis att alla tänkbara behörighetsfall är felfria.
- Den mindre isolerade SQL-simuleringen omfattade fem skolor, 20 vikarier, 50 uppdrag och 250 intresseanmälningar. 120 meddelanden fångades och inga skickades externt. Den använde syntetiskt Auth-schema och mätte inte riktig e-postleverans eller kapacitet.

## Vad som återstod efter leveransen

Avsändardomän, e-postleverantörens exakta DNS-poster, relevanta hostinginställningar och en faktiskt schemalagd worker var inte verifierade som färdigkonfigurerade. En cron-endpoint är inte samma sak som en aktiverad schemaläggning. Inga DNS-poster ändrades och inga externa testmejl skickades.

Riktig verifierings-/återställningsmejl, kompletta webbläsarflöden mot den skyddade Lovable-förhandsvisningen, Storage-flöden och återställningsprov från backup återstod. Lokal simulering ska inte tolkas som verifiering av dessa tjänster. REKO behöver också besluta om lagringstid och ansvar för gallring.

## Ny information från dagens fortsatta tester

Dagens tester har hittat en avbokningsbehörighet som behöver rättas, risk vid inbyggd formulärinlämning före JavaScript-start, dubblerad ansökningsstatistik och olika textgränser i formulär och databas. Dessa rättningar ingår **inte** i gårdagens levererade version.

De ligger i [utkast PR #2](https://github.com/wilmerjohanssonREKO/see-it-on-screen/pull/2) med separat [flödesrapport](flow-test-report-2026-11-13.md) och [pilotplan](pilot-plan.md). Dagens upptäckter innebär att gårdagens passerade tester behöver kompletteras före en större pilot.
