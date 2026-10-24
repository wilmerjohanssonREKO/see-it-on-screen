# Städning av koden

Målet: mindre och tydligare kod. Inget ändras i hur sidan ser ut eller fungerar, och ingen data raderas.

## Vad som görs
1. **Ta bort byggblock som aldrig används** (cirka 36 st, till exempel karuseller, menyer, reglage och diagram). De används inte någonstans i appen.
2. **Uppdatera ett föråldrat skrivsätt** i 10 serverfunktioner (`.inputValidator` → `.validator`) så att varningarna i loggen försvinner.
3. **Dela upp de största sidfilerna** så att de blir lättare att ändra:
   - Adminsidan (955 rader) delas upp, en fil per flik (Vikarier, Skolor, Lärare, Feedback, Data).
   - Profilsidan (508 rader) delas upp i kort (kontaktuppgifter, CV, profilbild).
4. **Rensa små rester**: oanvända importer, utkommenterad kod och kvarglömda hjälpfunktioner, till exempel från den borttagna avståndsmatchningen och de gamla statistikdelarna. Det som fortfarande används får vara kvar.
5. **Kontrollera** med typkontroll, befintliga tester och ett snabbt klick genom admin-, profil-, schema- och skolsidan.

## Rörs inte
- Databasen, säkerhetsreglerna, mejlutskicken och de automatiskt skapade filerna.
- Historisk data, till exempel gamla skolförfrågningar och betyg.

## Tekniska detaljer
- Oanvända shadcn-komponenter i `src/components/ui/` tas bort, efter att `rg` bekräftat att ingen importerar dem. Detsamma gäller deras npm-paket, om inget annat använder paketen.
- admin.tsx delas upp i `src/components/admin/*Tab.tsx`, och profil.tsx i `src/components/profile/*`.
- AGENTS.md uppdateras med en regel om hur filerna är uppdelade.
