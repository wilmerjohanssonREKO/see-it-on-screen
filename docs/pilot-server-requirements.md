# Utrymme för nästa pilotsteg

Den nuvarande arbetsmaskinen har ungefär 8 GB disk och en gräns på 524 288 inoder. Det räckte inte till officiell Storage med Docker VFS, trots att bokningsproven gick att köra. Att ändra domän eller köpa mer utrymme för den publika hemsidan löser inte den lokala begränsningen.

## Rekommenderad startpunkt

En separat Linux-testserver med fyra vCPU, 16 GB RAM och 80 GB SSD, Docker med en normal stödd lagringsdrivrutin och tillräckligt inodeutrymme. Dimensioneringen är en teknisk startpunkt för full miljö och fortsatta prov, inte en uppmätt kapacitetsgaranti. Vanliga alternativ är en större befintlig arbetsmiljö, en hyrd VM/VPS eller en egen dator med Docker och motsvarande resurser.

Ingen ny server har beställts. Ingen betald tjänst har aktiverats. Leverantör, månadskostnad och kostnadstak behöver beslutas innan beställning.

## Genomförande efter vald server

1. Skapa en helt separat testserver och åtkomst med personligt SSH-konto/nyckel. Lämna hemligheter i säker inställning, aldrig i chatt eller Git. Öppna inga publika databas-, Auth-, Storage- eller mailboxportar; använd SSH-tunnel/VPN för åtkomst.
2. Installera versionsbundna projektberoenden och hämta den granskade pilotgrenen. Använd bara syntetiska data. Bevara intern SMTP-fångst och nätverksisolering.
3. Starta backend med riktig Storage. Det läget finns förberett i `tests/pilot/fullstack/stack.py`, men är ännu inte verifierat och kan behöva integrationsrättningar. Kör migrations-, RLS- och Auth-proven på den nya miljön.
4. Verifiera CV-uppladdning, ägarskap, nekad främmande åtkomst, samtyckesåterkallelse och signerad länks utgångstid. Godkänn inte hela pilotmiljön innan dessa prov är gröna.
5. Kör samma modell med fem och tio webbläsaranvändare för en jämförbar funktionsbaslinje. Öka till 25 först efter granskning av resursmarginal, unika fixtures och hårda avbrottsgränser.
6. För högre belastning: kör generatorn på en separat maskin och byt utvecklingsserver/Docker-exec-brygga mot en kontrollerad driftslik installation. Anpassa då lokala URL-spärrar till en exakt tillåten testdestination; tillåt aldrig oavsiktlig trafik mot REKO:s riktiga backend.

Bestäm trafikprofil, p95-mål, acceptabel köålder och körningens längd före ett kapacitetsbesked. Ett visst antal öppna webbläsare är inte samma sak som en viss förfrågningstakt eller produktionskapacitet.
