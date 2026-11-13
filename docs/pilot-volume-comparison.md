# Jämförelse av lokala pilotprov

| Användare | Slutförda | DOM-klick | Hela körningen, s | API-anrop | API-fel | API p95, ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 5 | 49 | 177.8 | 278 | 0 | 1117.42 |
| 10 | 10 | 98 | 222.8 | 588 | 0 | 1700.5 |

Körningstid inkluderar antagna pauser och samordning mellan roller. API p95 mäter lokala webbläsarförfrågningar genom Docker-bryggan, inte driftens servicenivå.

| Användare | UI-åtgärd | Antal prov | Median, s | Längsta prov, s |
| ---: | --- | ---: | ---: | ---: |
| 5 | Publicera uppdrag | 2 | 0.97 | 0.99 |
| 5 | Välj vikarie | 2 | 0.84 | 1.20 |
| 5 | Begär avbokning | 2 | 0.38 | 0.43 |
| 5 | Godkänn avbokning | 2 | 0.63 | 0.64 |
| 10 | Publicera uppdrag | 4 | 0.70 | 1.02 |
| 10 | Välj vikarie | 4 | 1.36 | 1.85 |
| 10 | Begär avbokning | 4 | 0.35 | 1.17 |
| 10 | Godkänn avbokning | 4 | 2.03 | 4.32 |

UI-åtgärd räknas som uppmätt klicktid plus efterföljande väntan på det förväntade synliga resultatet. Föregående antagna läs-/skrivpauser och väntan på andra roller ingår inte. Antalet prov är litet; median och max är beskrivande stickprov, inte kapacitetslöften.

Endast slutförda, granskade lokala körningar ska användas. Storage ingår inte i dessa bokningskohorter.
