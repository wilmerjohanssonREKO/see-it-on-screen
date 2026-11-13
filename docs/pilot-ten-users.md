# Pilotprov: pilot-20261113T091643-eb5e37

Status: **PASSERAT**. 10/10 användare slutförde sina arbetsuppgifter, med 98 skriptade DOM-klick.
Kodversion: `5d1ecb76ff5596a073a4b28009df04a7987879cd`. Modellversion 1, testfrö 20261113, tänketidsfaktor 1.0.

| Roll | Slutförd | Klick | Uppgiftstid, s | Antagen tänketid, s | Samordningsväntan, s |
| --- | --- | ---: | ---: | ---: | ---: |
| school-0 | Ja | 12 | 168.2 | 54.3 | 83.1 |
| substitute-1 | Ja | 9 | 170.0 | 67.3 | 69.5 |
| school-2 | Ja | 12 | 180.7 | 62.4 | 81.8 |
| substitute-3 | Ja | 9 | 181.6 | 71.9 | 74.8 |
| school-4 | Ja | 12 | 187.1 | 50.7 | 103.2 |
| substitute-5 | Ja | 9 | 189.2 | 78.0 | 79.5 |
| school-6 | Ja | 12 | 196.7 | 58.5 | 111.3 |
| substitute-7 | Ja | 9 | 194.3 | 69.0 | 98.4 |
| admin-8 | Ja | 11 | 216.4 | 50.3 | 127.1 |
| spectator-9 | Ja | 3 | 43.9 | 23.6 | 0.0 |

Uppgiftstid mäts från öppnad inloggning till respektive användares färdiga uppgift. Den inkluderar antagna läs-/skrivpauser och väntan på andra roller. Samordningsväntan organiseras av testet och är inte systemets svarstid. Native bekräftelser redovisas separat i JSON; de ingår inte i DOM-klickantalet.

JavaScript-sidfel: 0. Den sammanlagda körningen tog 222.8 sekunder inklusive avslutning av webbläsare och inspelning.

## Databaskontroll

```json
{
  "assignments": 4,
  "open": 4,
  "approved_cancellations": 4,
  "unsafe_fixtures": 0,
  "overlapping_allocations": 0,
  "run_outbox": 16,
  "run_captured": 8,
  "run_cancelled": 8,
  "run_unexpected_notice_state": 0,
  "external_sent": 0,
  "pending": 0,
  "captured": 8
}
```

## Tolkning

Detta är en lokal isolerad körning med syntetiska konton. Ett godkänt prov visar att de valda flödena klarades i den miljön. Det verifierar inte produktionskapacitet eller hur fort verkliga människor genomför uppgifterna. Inbjudningar, återställning, privat filhantering och extern leverans kräver separata integrationsprov.
