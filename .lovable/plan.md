# UX-granskning och riktade förbättringar — REKO UF

## Mål och avgränsning
Gör befintliga sidor lättare att förstå och använda för skolor, lärare och vikarier. Behåll färger, typsnitt, logga, kalenderns placering och fungerande flöden. Inga nya funktioner, ändrade behörigheter eller ändringar i databas och mejlutskick.

## Granskning: vad som redan fungerar
- **Hick:** startsidan har två tydliga vägar; ämnesfiltret visas bara när det finns flera ämnen.
- **Fitts:** publicering och bokning har tydliga, breda knappar.
- **Jakob:** loggan leder hem, formulär har välbekanta fält och kalendern är svensk med måndag först.
- **Miller:** varje jobb har eget kort; profilen är uppdelad efter innehåll.
- **Närhet:** datum och tider har etiketter; information om ett jobb hålls samlad.

## Prioriterad rapport och föreslagna ändringar

| Prioritet | Plats och problem | Princip | Varför det kan skapa friktion | Förbättring |
|---|---|---|---|---|
| Hög | Sidhuvud: alla inloggade länkar ligger i en rad utan mobilanpassad uppdelning. | Hick, Fitts, Jakob | Länkar konkurrerar om utrymmet på små skärmar. | Behåll viktigaste länkar synliga. Samla övriga befintliga länkar i en namngiven meny på mobil, med tydlig aktuell sida och åtkomlig Logga ut-knapp. Ta inte bort någon väg. |
| Hög | Profil: bild- och CV-uppladdning använder en etikett som ser ut som en knapp. | Fitts, Jakob | Filvalet saknar ett säkert, vanligt tangentbordsbeteende. | Använd riktiga knappar för filval, med samma spärrar, samtycken och uppladdningshantering. Koppla samtyckestext uttryckligen till kryssrutorna. |
| Hög | Lärarregistrering och skolans ämnesval saknar uttrycklig etikettkoppling. Lärarens felmeddelande annonseras inte. | Jakob, närhet | Hjälpmedel kan missa vilket fält eller fel som avses. | Koppla etiketter till valen. Gör felmeddelanden hörbara för skärmläsare och koppla dem till berörda fält där det är möjligt. |
| Hög | Inloggningssidan säger ”För vikarier och REKO UF-teamet” trots att skolor och lärare också loggar in här. | Jakob, Hick | Skolpersonal kan tro att de kommit fel. | Ändra endast texten till ”För vikarier, skolor, lärare och REKO UF-teamet.” Behåll gemensam inloggning. |
| Medel | Flera knappar och fält är 32–36 px höga; växlingen till vikariekonto är cirka 20 px hög. | Fitts | Små ytor är svårare att trycka på med fingret. | Ge berörda knappar, fält och länkar minst 44 px träffyta. Ändra inte kalenderns fasta mått eller alla kontroller i hela appen automatiskt. |
| Medel | Skolformuläret blandar grunduppgifter och valfria detaljer; adminformuläret blandar ersättning med schemauppgifter. | Miller, närhet | Användaren måste läsa varje fält för att förstå sambanden. | Gruppera ämne, datum och tid; håll Från/Till tillsammans. Lägg ersättning och beskrivning i en separat, alltid synlig grupp för valfria uppgifter. Inga extra klick eller ändrade krav. |
| Medel | Skolans jobbkort blandar status, Läs CV och Tacka nej i samma rad. | Närhet, Miller | Besked och handlingar blir svårare att skilja åt när raden bryts. | Separera status från handlingar inom samma jobbkort; behåll befintlig bekräftelse vid Tacka nej. |
| Medel | Admin har åtta flikar i en rad som får brytas, men flikraden har fast höjd. | Hick, Fitts | Brutna rader kan trängas och bli svåra att träffa. | Ge raden automatisk höjd, tydliga avstånd och större träffytor. Behåll flikarnas namn, ordning och innehåll; ingen ny adminstruktur. |
| Medel | Kalenderns jobbkategorier förmedlas främst med färg. | Jakob, tillgänglighet | Den som inte urskiljer färger saknar samma information. | Lägg jobbkategori i datumknapparnas tillgängliga namn och en diskret icke-färgbaserad markering om det behövs. Behåll dagens ring och jobblistan; återinför inte den borttagna sidospalten. |

Fitts-förslaget använder 44 px som mål för enklare mobilanvändning, inte som ett påstående om att alla mindre kontroller bryter mot tillgänglighetskrav.

## Vad som faktiskt kontrollerats
- Startsida, inloggning och lärarregistrering har öppnats i webbläsare vid 390 × 844 och 890 × 639. Ingen horisontell överströmning på dessa sidor.
- Skol-, schema-, profil- och adminsidor har granskats i koden. Deras inloggade arbetsflöden har **inte** körts i denna granskning.
- Rapporten beskriver observerade utformningsproblem och möjliga friktionsrisker, inte uppmätt förvirring hos verkliga användare. En tidigare observation om separerade tider i skolformuläret kunde inte bekräftas: Från och Till ligger redan bredvid varandra på större skärm.

## Genomförande efter godkännande
1. Börja med navigation, inloggning och tillgängliga kontroller.
2. Justera grupperingen i formulär, jobbkort och adminflikar.
3. Komplettera kalenderns tillgänglighet utan att ändra sortering, bokning eller filter.
4. Kontrollera berörda sidor på mobil, surfplatta och dator, med tangentbord och skärmläsarnamn.
5. Kör befintliga relevanta tester och kontrollera skolans publicering, vikariens bokning och skolans avböjande genom sidorna med separata sandlådekonton. Inga riktiga mejlutskick eller ändringar av riktiga konton.
6. Lämna en slutrapport med ändringar, verifierade flöden och eventuella kvarstående hinder. Mät faktisk klickräkning och automatiserad tidsåtgång där flödena kan köras; redovisa inte automatiserad tid som verkliga användares arbetstid.

## Tekniska detaljer
- Ändringar begränsas till befintliga presentationsfiler och UI-komponenter. Återanvänd designkomponenter och färgvariabler; inga nya paket behövs.
- Kontrollera sidtitlar och beskrivningar för innehållssidor vid genomförandet.
- Behåll alla befintliga kontroller för samtycke, filstorlek, filtyp och behörighet. Ingen migration.

## Kvarstående frågor utanför detta arbete
- Riktiga kontaktuppgifter behövs fortfarande på kontaktsidan och i policyn.
- Verkliga användartester och leverans till skolors riktiga mejladresser kan inte ersättas av denna UX-granskning.
- Startsidan och övriga etablerade designbeslut ändras inte av dekorativa skäl.