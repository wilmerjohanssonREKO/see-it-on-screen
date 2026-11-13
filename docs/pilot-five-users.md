# Pilotprov: pilot-20261113T091256-04d604

Status: **PASSERAT**. 5/5 användare slutförde sina arbetsuppgifter, med 49 skriptade DOM-klick.
Kodversion: `5d1ecb76ff5596a073a4b28009df04a7987879cd`. Modellversion 1, testfrö 20261113, tänketidsfaktor 1.0.

| Roll | Slutförd | Klick | Uppgiftstid, s | Antagen tänketid, s | Samordningsväntan, s |
| --- | --- | ---: | ---: | ---: | ---: |
| school-0 | Ja | 12 | 160.6 | 54.3 | 82.3 |
| substitute-1 | Ja | 9 | 160.2 | 67.3 | 67.7 |
| school-2 | Ja | 12 | 170.3 | 62.5 | 85.2 |
| substitute-3 | Ja | 9 | 171.0 | 71.8 | 75.7 |
| admin-4 | Ja | 7 | 173.8 | 27.1 | 127.1 |

Uppgiftstid mäts från öppnad inloggning till respektive användares färdiga uppgift. Den inkluderar antagna läs-/skrivpauser och väntan på andra roller. Samordningsväntan organiseras av testet och är inte systemets svarstid. Native bekräftelser redovisas separat i JSON; de ingår inte i DOM-klickantalet.

JavaScript-sidfel: 0. Den sammanlagda körningen tog 177.8 sekunder inklusive avslutning av webbläsare och inspelning.

## Databaskontroll

```json
{
  "assignments": 2,
  "open": 2,
  "approved_cancellations": 2,
  "unsafe_fixtures": 0,
  "overlapping_allocations": 0,
  "run_outbox": 8,
  "run_captured": 4,
  "run_cancelled": 4,
  "run_unexpected_notice_state": 0,
  "external_sent": 0,
  "pending": 0,
  "captured": 4
}
```

## Tolkning

Detta är en lokal isolerad körning med syntetiska konton. Ett godkänt prov visar att de valda flödena klarades i den miljön. Det verifierar inte produktionskapacitet eller hur fort verkliga människor genomför uppgifterna. Inbjudningar, återställning, privat filhantering och extern leverans kräver separata integrationsprov.
