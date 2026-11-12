# Godkänd säkerhets- och driftplan

## Implementerat på arbetsgrenen (ännu inte driftsatt)

- [x] Kontoisolerad cache, avbrutna hämtningar och remount av privata vyer vid kontobyte.
- [x] Samma 6 px hörn på textfält, lösenord, datum/tid, textrutor och rullistor.
- [x] Personliga admininbjudningar i stället för offentlig delad skolkod; verifierad e-post, engångstoken, tidsgräns och eget lösenord.
- [x] Lösenordsåterställning och samlad roll-/profilstyrning efter inloggning.
- [x] Intresseanmälan och skolans uttryckliga val av vikarie.
- [x] Databasregler för framtida uppdrag, samtidiga överlapp, säker återöppning och avbokningsbegäran till REKO-admin.
- [x] Transaktionell utskickskö med leveransstatus, retry, versionsnycklar och testmejlfångst.
- [x] Återupptagbar kontoborttagning som bevarar avslutade uppdrag samt skydd mot radering av skolhistorik.
- [x] Index, sidindelning, samlade profilbildsanrop, billigare unik visningsloggning och RLS-paritet.
- [x] Lokala SQL-/behörighetstester inklusive två samtidiga skolval, enhetstester, bygg-/typkontroller och webbläsarkontroller.
- [x] GitHub Actions för automatiska kontroller och dokumenterad införandeplan.

## Krävs inför drift — inte markerat klart av kodtester

- [ ] Bekräfta backup och återställningsprov i separat miljö.
- [ ] Inför migreringarna och matchande kod kontrollerat; verifiera faktisk Lovable-synk och produktionsflöden i testläge.
- [ ] Konfigurera Supabase e-postverifiering och tillåtna återställnings-/inbjudningsadresser.
- [ ] Verifiera transaktionell mejldomän och korrekta DNS-poster med vald leverantör.
- [ ] Konfigurera hemligheter och schemalägg det autentiserade utskicksjobbet.
- [ ] Prova verklig leverans till en av REKO kontrollerad testbrevlåda efter uttryckligt godkännande.
- [ ] Besluta lagringstider innan ytterligare automatisk radering aktiveras.
- [ ] Bekräfta produktionsövervakning, larm och ansvarig operatör.

Se docs/rollout.md. Ursprungliga konton med testnamn är inte isolerade som sandlådedata och har inte ändrats eller använts för skrivtester.
