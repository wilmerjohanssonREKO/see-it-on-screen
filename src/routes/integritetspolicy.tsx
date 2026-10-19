import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/integritetspolicy")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy — REKO UF" },
      { name: "description", content: "Hur REKO UF lagrar och behandlar dina personuppgifter." },
      { property: "og:title", content: "Integritetspolicy — REKO UF" },
      { property: "og:description", content: "Hur REKO UF lagrar och behandlar dina personuppgifter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const sections: { title: string; body: string[] }[] = [
  {
    title: "Vilka uppgifter vi sparar",
    body: [
      "När du skapar ett konto sparar vi ditt namn, din mejladress och ditt telefonnummer. Som vikarie sparar vi även din adress (gatuadress, postnummer och ort), dina ämnen, ditt CV och utdrag ur belastningsregister, om du laddar upp dem.",
      "Skolor sparar skolans namn, kontaktperson, kontaktuppgifter och adress.",
    ],
  },
  {
    title: "Varför vi sparar uppgifterna",
    body: [
      "Uppgifterna används för att matcha vikariebehov med vikarier: skolan publicerar ett behov, och godkända vikarier med rätt ämne får en notis. Din adress används bara för att räkna ut avståndet till skolan — aldrig för att visa var du bor för någon annan.",
      "Ditt CV och ditt belastningsregisterutdrag delas bara med skolor du har anmält dig till eller blivit tilldelad ett uppdrag hos, och bara om du gett ditt samtycke.",
    ],
  },
  {
    title: "Användningsloggen",
    body: [
      "Vi loggar hur tjänsten används — till exempel när ett vikariebehov publiceras, öppnas och tillsätts — för att kunna förbättra matchningen och förstå vad skolor och vikarier behöver.",
      "Loggen är pseudonymiserad: vikarier lagras som en kod som inte kan länkas tillbaka till dig av någon annan än systemet. Loggen innehåller aldrig namn, mejladresser, telefonnummer eller postnummer.",
    ],
  },
  {
    title: "Dina rättigheter",
    body: [
      "Du kan när som helst se och ändra dina uppgifter på din profilsida. Du kan ta bort ditt CV när du vill.",
      "Vill du ta bort hela ditt konto och alla uppgifter vi har om dig, kontakta oss så raderar vi allt.",
    ],
  },
  {
    title: "Kontakt",
    body: [
      "Har du frågor om hur vi hanterar dina uppgifter? Kontakta [ERT NAMN] på [ER E-POST] eller [ERT TELEFONNUMMER].",
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        <h1 className="text-4xl font-bold text-foreground">Integritetspolicy</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Här förklarar vi vilka uppgifter REKO UF sparar, varför vi sparar dem och vilka rättigheter du har.
        </p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
