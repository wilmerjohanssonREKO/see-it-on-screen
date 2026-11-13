# Förslag: simulerad REKO-pilot

Datum: 2026-11-13. Beslutsunderlag; ingen fullskalig pilot är genomförd.

## Mål och omfattning

Verifiera att hela kedjan fungerar: inbjudan och verifierat konto → behörighet och granskning → publicering → intresse → skolans val → kontakt och privata filer → avbokning och REKO-beslut → köade meddelanden → historik och radering. Skilj tekniska tester från deltagarnas bedömning av begriplighet.

Föreslagen testmängd: fem skolor med en skolansvarig och två lärare vardera, 50 vikarier (35 godkända, åtta ogranskade, fyra med förnyelsebehov, tre avaktiverade), två administratörer och 250 uppdrag över fyra simulerade veckor. Kör därefter 20–50 samtidiga användare enligt överenskommen trafikprofil. Dessa siffror är ett förslag, inte uppmätt kapacitet.

Komplettera automationen med fyra till sex personer som spelar roller i tre pass om 60–90 minuter på mobil och dator.

## Miljö och genomförande

1. Skapa en separat Supabase-miljö eller full lokal stack med riktig Auth och Storage. Använd samma kod och migreringar som målversionen. Använd enbart syntetiska identiteter och filer.
2. Koppla Auth och appens meddelanden till lokal e-postfångst, exempelvis Mailpit. Begränsa utgående nätverk så att pilotmiljön inte kan skicka riktiga meddelanden. Appens sandboxläge är ett extra skydd.
3. Bygg versionsstyrd seedning, ett körnings-ID och återställning som enbart kan träffa pilotmiljön. Återställ även Auth, Storage och e-postfångst. Registrera kodversion, dataversion och testfrö.
4. Använd explicit tidsstyrning eller separata gränstids-fixtures. SQL använder `now()`; framtida uppdrag simulerar inte automatiskt fyra veckors utgångstider, återförsök och påminnelser. Bestäm hur ogiltiga och dubbla lokala tider vid sommartidsbyte ska hanteras.
5. Kör funktionstester och negativa behörighetstester före belastning. Kör därefter samtidighet, felinjektion, återhämtning och deltagarpass. Samla avvikelser med förväntat/faktiskt utfall och återtesta rättningar.

## Obligatoriska scenarier

- Inbjudan: rätt/fel mejl, ej verifierad adress, utgången, återkallad och återanvänd token; lösenordsåterställning och rollstyrd landningssida.
- Granskning: ej godkänd och avaktiverad vikarie; skol- och lärarmedlemskap; spärr mot annan skola och annan sandbox.
- Matchning: flera sökande, återkallande och återanmälan, skolans val, samtidiga val på samma uppdrag samt överlappande uppdrag för samma vikarie.
- Avbokning: skolans respektive vikariens begäran, avslag, godkännande, upprepat klick, ändrad tilldelning, uppdrag som redan börjat och bevarad historik. Tidigare sökande får inte läsa senare avbokningsorsaker.
- Filer: CV-samtycke, återkallat samtycke, ägarskap, otillåten sökväg, signerad länks utgångstid och nekad åtkomst efter ändrad relation.
- Meddelanden: leverantörsfel, fördröjning, lease-utgång, återförsök och krasch efter leverans före kvittens; inga dubbla logiska meddelanden. Helt verifierad leverans kräver även kontroll av leverantörens idempotens.
- Klient: utloggning och kontobyte, sen nätverksrespons från förra kontot, avbruten laddning, offline, felmeddelande och återförsök, tangentbord och mobil.
- Radering: bevarad genomförd historik, återupptagen delvis misslyckad radering, ingen felaktig återöppning av gamla uppdrag.

## Mätning och godkännandekrav

Föreslagna absoluta krav: noll obehöriga läsningar, noll dubbeltilldelningar, noll felaktigt återöppnad historik, noll externa testutskick och inga öppna allvarliga fel. Alla obligatoriska scenarier ska ha dokumenterat utfall.

Välj svarstids- och leveransmål efter en baslinjemätning. Ett möjligt svarstidsmål är p95 under två sekunder vid överenskommen belastning, men detta är ännu inte verifierat. Mät köålder, återförsök/fel, API-latens, databasbelastning och tilldelningskonflikter.

Nuvarande utskicksjobb behandlar högst tio jobb per körning. Vid en körning per minut blir taket ungefär tio meddelanden/minut före leverantörslatens och återförsök. En topp med 250 bokningar ger minst 500 bekräftelser och cirka 50 minuters kötid vid den takten. Välj därför leveransmål, körfrekvens, batchstorlek och tillåten parallellism tillsammans; kontrollera leverantörens gränser innan ett kort leveranslöfte ges.

## Beslut som behövs från REKO

- Vem ansvarar för pilotmiljön, deltagarna och godkännandet?
- Vilket kostnadstak gäller för separat miljö och leverantörer?
- Vilken samtidig användning och vilken leveranstid ska piloten klara?
- När ska testdata återställas och raderas?

Ett preliminärt planeringsantagande är några arbetsdagar för miljö, testdata och automatisering, följt av automatiserade körningar och deltagarpass. Bekräfta omfattning och tekniska förutsättningar innan tidplanen låses.

## Nuvarande bevis och kvarstående luckor

En mindre isolerad SQL-simulering på version `96d0005` har passerat med fem skolor, 20 vikarier, 50 uppdrag, 250 intresseanmälningar, fem godkända och fem avslagna avbokningar samt fem ersättningar. 120 meddelanden fångades, noll skickades externt och inga överlappande tilldelningar återstod. Det är ett funktionellt stickprov med syntetiskt Auth-schema; det bevisar inte kapacitet, riktig Auth, Storage eller extern leverans.

Se [flödesrapporten](flow-test-report-2026-11-13.md) för utökade tester och rättningar som ska hanteras före en större pilot.
