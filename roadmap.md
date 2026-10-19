# Roadmap

- [x] Replace public school request form with a contact page and remove the admin request tab; preserve historical data and school accounts

- [x] Admin can fully delete any substitute (incl. login)
- [x] School can decline an assigned substitute (assignment reopens)
- [ ] Email to school + substitute on match — blocked: needs a sender email domain owned by the user

- [x] MVP cleanup: remove admin test tools, substitute ratings/statistics, profile admin promotion and duplicate homepage admin login; preserve existing data and core flows
- [x] Add school/substitute addresses and require essential contact details; preserve existing accounts
- [x] Security hardening + flow fixes from site review

- [x] Logo: vit REKO UF-text på blå bakgrund i sidhuvudet
- [x] CV-funktion: uppladdning med samtycke, behörighetsstyrd läsning via 60-sekunderslänkar
- [x] Avstånd i matchningen: lat/lng, Haversine, kort varsel (<24h) inom 15 km (minst 3), "ca X km"-visning — verifierat i webbläsaren
- [ ] Loggsystem för statistik: event_log (pseudonymiserad), assignment_metrics-vy, admin-flik "Data" med CSV-export och gallring — från uppladdad spec
- [x] Ändra kort varsel till 2 timmar och avståndsradien till 10 km (i notify_matching)
