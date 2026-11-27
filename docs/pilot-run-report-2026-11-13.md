# REKO: rättningar och första pilotprov, 13 november 2026

## Infört i Lovable

PR #2 är sammanslagen som `5d1ecb76ff5596a073a4b28009df04a7987879cd`. Lovable verifierades redo på samma version och migrering 0023 registrerades atomiskt som post 24. Befintliga sju profiler, skolan och uppdraget hade oförändrade kontrollsummor efter migreringen. Webbplatsen publicerades inte av denna ändring.

Rättningar: faktisk partsrelation för avbokningsorsaker, POST och avstängd skicka-knapp före hydrering i inloggningsformuläret, enkel loggning per faktisk intresseanmälan och gemensam gräns på 500 tecken i avbokningsfältet. Se `test-evidence/release-0023.json`.

## Separat miljö och testmodell

En separat lokal miljö finns med riktig PostgreSQL 17, PostgREST 13.0.5, Supabase Auth/GoTrue 2.183.0 och intern Mailpit 1.27.8. Tio syntetiska rollkonton har skapats; inga produktionskonton eller uppdrag har importerats. Normal registrering kräver mejlbekräftelse. De förberedda rollkontona bekräftas uttryckligen vid seedning, medan en separat kontroll provar den verkliga verifieringskedjan.

Appen körs på `http://127.0.0.1:5182` mot lokalt API på port 54451. Adresserna gäller denna arbetsmaskin och är inte publika testlänkar. Manifest med lokala lösenord och sessioner hålls utanför Git. Intern Docker-network, avstängda proxyvariabler i tjänsterna och Mailpit som enda SMTP-mål isolerar mejlen. Appens sandbox fångar bokningsmeddelanden.

Modellen v1 i `pilot-test-model.md` och `tests/pilot/browser/model.json` definierar rollflöden, reproducerbara pauser, mätvärden och stoppkrav. Klick, inmatningar, nätverksanrop, synlig UI-väntan, antagna pauser och väntan på andra roller redovisas separat. Pauserna är antaganden, inte uppmätt mänskligt beteende. Inmatning använder automatisk fältfyllning efter skrivpaus, inte individuell tangenttryckning.

## Verifierad registrering och återställning

Sex kontroller passerade: overifierat konto nekas inloggning, internt levererad SMTP-länk verifierar adressen, verifierat konto kan logga in, REKO:s återställningsformulär skickar ett riktigt lokalt mejl, länken öppnar formuläret för nytt lösenord och endast det nya lösenordet fungerar efteråt. Registreringsdelen körs via verkligt Auth-API; återställningen går genom appens UI. Se `test-evidence/auth-real-recovery.json`.

## Körningsresultat

| Prov | Slutförda användare | DOM-klick | Total tid inkl. pauser | API-anrop | API-fel / JS-fel |
| --- | ---: | ---: | ---: | ---: | --- |
| Fem samtidiga kontexter | 5/5 | 49 | 177,8 s | 278 | 0 / 0 |
| Tio samtidiga kontexter | 10/10 | 98 | 222,8 s | 588 | 0 / 0 |

Båda kördes med fulla antagna pauser (faktor 1), unika konton inom körningen och återställd pilotdata mellan stegen. Fem-provet verifierade två publiceringar, två val och två godkända avbokningar; tio-provet verifierade fyra av varje. Efteråt var alla uppdrag korrekt återöppnade utan tilldelning, inga överlappande tilldelningar fanns och inga externa utskick eller väntande meddelanden återstod. Kön hade fyra respektive åtta fångade avbokningsmeddelanden och lika många avsiktligt stoppade inaktuella bokningsbekräftelser.

[Volymjämförelsen](pilot-volume-comparison.md) visar även tid från klick till synligt resultat. I fem-provet tog publicering median 0,97 s och skolans val 0,84 s; detta är små lokala stickprov, inte driftslöften. Separata rapporter finns för [fem](pilot-five-users.md) och [tio](pilot-ten-users.md) användare. Inspekterad syntetisk JSON finns i `test-evidence/`; fulla nätverksloggar och två videor hålls privata.

Appen kör Vites utvecklingsserver i dessa prov. Mätvärdena omfattar den lokala HTTP-bryggan. Varken API p95 eller DOM-väntan är ett uppmätt servicenivålöfte för Lovable. De här stegen fastställer inte systemets maximala användarantal.

## Vad provkörningen upptäckte i testverktyget

- Skolor seedades först med fel testmarkering eftersom adminidentiteten inte följde med till ett nytt SQL-anrop. Sandbox spärrade korrekt matchningen. Seedning och startkontroller rättades; pilotdata återställdes innan nya körningar.
- HTTP-bryggan stängde först anslutningen för tidigt, vilket avbröt Auth-anrop. Bryggan håller nu anslutningen öppen tills svaret är läst.
- Inspelning behövde kopplas till arbetsmaskinens installerade ffmpeg. Ett videoprov verifierade lösningen.
- Första snabbprovet slutförde alla tre rolluppgifter men hade fel förväntan på meddelandekön. I denna modell bearbetas kön efter avbokningen. Två inaktuella bokningsbekräftelser ska då stoppas och två aktuella avbokningsmeddelanden fångas per uppdrag. Databasen visade exakt detta. Testets förväntningar rättades; oväntade mallar/statusar fortsätter att ge fel.

Dessa försök redovisas som felsökning av testmiljön, inte som godkända volymprov.

## Öppen begränsning: privata filer

**Storage är inte verifierad och den kompletta pilotmiljön är inte godkänd.** Officiell Storage-container och mindre lokala varianter slog i arbetsmaskinens disk-/inodgräns. Körningen använder därför uttryckligt `--without-storage`: endast Storage-schemat finns som testdubbel för migreringarna och fil-API svarar 503. Inga CV-uppladdningar, privata signerade länkar, samtyckesåterkallelser eller länkars utgångstider räknas som passerade.

Arbetsmaskinen har två CPU-kärnors kvot, 8 GiB minne, cirka 8 GB disk och 524 288 inoder. Testgenerator och app delar maskin. Docker-exec-bryggan tillför dessutom mätbar overhead. Resultaten visar lokala funktionella flöden och kan inte extrapoleras till Lovables hostingkapacitet.

## Fortsättning

Flytta eller komplettera miljön med tillräckligt utrymme för riktig Storage och verifiera filflödena före godkännande av hela piloten. Utöka sedan modellen med lärarinbjudan, fler negativa beteenden, felinjektion, längre körningar och riktiga deltagare. En stor belastningskörning behöver separat dimensionerad generator och systemmiljö samt beslut om trafikmål, leveranstid och kostnadstak.

En ny start från de installerade repo-skripten passerade också: fyra testskolor, tio testprofiler, tom uppdragsdata, fungerande Auth-hälsa och inloggningssida. Se `test-evidence/pilot-cold-start.json`. Resursmätningen under proven visade högst 4,98 GiB totalt och inga OOM-avslut; den visar inte en separat belastning per app respektive generator.

[Serverkraven](pilot-server-requirements.md) beskriver hur nästa miljö kan få tillräckligt utrymme. Kod och körinstruktioner finns i `tests/pilot/README.md`. Appens externa e-postavsändare, DNS, leverantör och driftens schemaläggning ändrades inte i detta arbete.
