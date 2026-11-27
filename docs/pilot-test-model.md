# REKO pilotmodell v1

Beslutad arbetsordning 2026-11-13: inför rättningarna, bygg separat testmiljö, provkör och öka därefter volymen. Denna modell gäller lokala, syntetiska prov. Den mäter inte Lovables driftkapacitet.

## Isolering och startvillkor

- Grundprovet A kör samma appkodversion som referensversionen i GitHub, mot en separat lokal databas och riktig Auth. Filprovet B kräver dessutom fungerande riktig privat Storage. Auth-mejl går till intern mejlfångst; bokningsmeddelanden fångas av appens sandbox.
- Använd bara unika syntetiska konton och skolor. Produktionskonton, lösenord och data ska aldrig importeras.
- Dokumentera kodversion, komponentversioner, testfrö, antal användare, datorresurser och modellversion vid varje körning.
- Verifiera grundkedjan före volymökning av bokningsflödena: registrering med verifieringsmejl, inloggning och ett komplett boknings-/avbokningsförlopp. Privat filåtkomst måste passera separat före volymtest av filflöden och godkännande av en komplett pilotmiljö. Schema-testdubbel för Storage får bara användas i uttryckligt begränsat bokningsprov; ange detta i manifest och resultat.
- Miljön ska kunna stoppas och återställas reproducerbart. Återställning får bara beröra namngivna pilotresurser.

## Första webbläsarkohorten

Fem samtidiga separata webbläsarkontexter: två skolor, två vikarier och en administratör. Varje skola/vikarie-par har ett eget uppdrag och unika användaridentiteter. Vikarier använder mobilbredd; skola/admin datorbredd.

Skola: inloggning → ämnesval → datum/tider/beskrivning → publicering → granska intresseanmälan → välj vikarie → se återöppnat uppdrag efter avbokning.

Vikarie: inloggning → hitta uppdrag → anmäl intresse → återkalla → anmäl igen → se tilldelning och tillåten skolkontakt → begär avbokning → se godkänt beslut och möjlighet att anmäla intresse igen.

Admin: inloggning → hitta respektive begäran → godkänn avbokning → öppna meddelandekön och fånga testutskick. Backendkontroll verifierar att två uppdrag är öppna utan kvarvarande tilldelning, två avbokningar godkända och att inga överlappande tilldelningar eller externa utskick finns.

## Tidsmodell och mätning

Standardantaganden: läspauser 2–8 sekunder, skrivpauser 15–45 sekunder och navigationspauser 1–4 sekunder. Fördelningen är jämn inom intervallet, med reproducerbart slumpfrö. Det är antagna beteenden, inte data från riktiga personer. Skrivpauser följs av automatisk fältinmatning; denna version simulerar inte varje tangenttryckning.

Redovisa separat:

- Klick och inmatningar med etikett och utfall.
- Sidnavigering, väntan på synligt resultat och nätverksförfrågningars varaktighet.
- Antagna pauser, totaltid till användarens egen slutförda uppgift och väntan på andra roller i scenariot.
- Fel, ej slutförda uppgifter, JavaScript-fel och integritetskontroller.

Ett klicks varaktighet är tiden tills webbläsaren har utfört klicket, inte nödvändigtvis till serverns arbete är klart. Därför mäts synligt resultat separat. Samordningsväntan är inte systemlatens. URL-parametrar, lösenord och token ska inte tas med i den publicerade resultatrapporten. Råa traces och videor hålls privata eftersom de kan innehålla testsessioner.

## Stegvis volym

1. Fem användare, fulla antagna pauser. Alla uppgifter och integritetskontroller måste passera.
2. Tio användare med unika identiteter inom körningen och tillräckliga fixtures. Återställ pilotdata mellan stegen. Kontrollera testgeneratorns CPU/minne, app och databas innan nästa steg.
3. 25 användare om miljön har marginal. Vid mättad testgenerator ska kapaciteten flyttas till större eller separat generator före fortsatt slutsats om appen.
4. 50, 100 och 250 är senare mål, inte uppmätt eller garanterad kapacitet. De kräver motsvarande fixtures, granskad resursbudget och mätning av både generator och system under test.

Öka bara när föregående steg är grönt. Stoppa vid integritetsfel, obehörig åtkomst, externa testutskick, misslyckad obligatorisk uppgift eller resursbrist. Dokumentera avbrottet och återtesta efter rättning innan volymökning. Inför större körningar bestäms även gräns för felandel, p95-latens och maximal köålder efter baslinjemätningen.

## Modellens gränser

Den första kohorten täcker centrala bokningsflöden. Lärarinbjudan, återställningslänk, signerade filers utgångstid, långkörning, nätverksfel och fler beteendevarianter behöver egna scenarier. Appens sandboxinbjudan utelämnar av säkerhetsskäl själva bearer-token; verifierad intern Auth-mejl betyder därför inte att appens kompletta inbjudningsleverans har verifierats.

Lokala resultat visar funktion och begränsningar i just testmiljön. Före en kapacitetsbedömning för verklig drift behövs en motsvarande separat hostingmiljö och överenskommet trafik-/leveransmål. Några mänskliga deltagare behövs för att validera antagna pauser och begriplighet.
