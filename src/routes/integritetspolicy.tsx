import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { PublicFooter } from "@/components/PublicFooter";

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
    title: "Vem ansvarar för dina uppgifter",
    body: [
      "REKO UF är personuppgiftsansvarig. REKO UF är en förmedlingstjänst: vi kopplar ihop gymnasieskolor med vikarier. Vi är inte arbetsgivare och hyr inte ut personal — anställningen sker mellan skolan och vikarien. Vi tar aldrig betalt av vikarier.",
      "Kontakt: [ERT NAMN], [ER E-POST], [ERT TELEFONNUMMER].",
    ],
  },
  {
    title: "Vilka uppgifter vi sparar",
    body: [
      "Namn, mejladress och telefonnummer. Som vikarie även adress (för att räkna ut avstånd till skolor), ämnen, tillgänglighet och ditt CV om du laddar upp det.",
      "Vi sparar inte ditt utdrag ur belastningsregistret. Du visar upp originalet och vi noterar bara att det är kontrollerat och när.",
      "Skolor och lärare: skolans namn, kontaktperson, kontaktuppgifter och adress.",
      "Du måste vara 18 år eller äldre för att bli vikarie.",
    ],
  },
  {
    title: "Varför vi får spara dem",
    body: [
      "Uppgifterna behövs för att tjänsten ska fungera — att matcha vikariebehov med vikarier (avtal, artikel 6.1 b i dataskyddsförordningen).",
      "Användningsloggen sparas för att förbättra tjänsten (berättigat intresse, artikel 6.1 f). Den är pseudonymiserad och innehåller aldrig namn, mejl, telefonnummer eller postnummer.",
      "Ditt CV delas bara med skolor du anmält dig till eller fått uppdrag hos, och bara om du har samtyckt. Samtycket kan du ta tillbaka genom att ta bort ditt CV.",
    ],
  },
  {
    title: "Vem som får del av uppgifterna",
    body: [
      "Skolor ser namn, kontaktuppgifter och ungefärligt avstånd för vikarier som anmält sig till deras uppdrag — aldrig din hemadress.",
      "Uppgifterna lagras hos vår molnleverantör inom EU/EES. Postnummer och ort skickas till kartjänsten OpenStreetMap (Nominatim) för att räkna fram en ungefärlig position.",
    ],
  },
  {
    title: "Hur länge vi sparar dem",
    body: [
      "Kontouppgifter sparas så länge du har ett konto. Tar du bort kontot raderas profil, CV och kopplingar. Konton som inte använts på 24 månader raderas.",
      "Användningsloggen raderas efter 12 månader.",
    ],
  },
  {
    title: "Dina rättigheter",
    body: [
      "Du har rätt att få veta vilka uppgifter vi har om dig, få dem rättade eller raderade, invända mot behandlingen och få ut dem i ett läsbart format. Du ändrar det mesta själv på din profilsida — kontakta oss för resten.",
      "Är du missnöjd med hur vi hanterar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten (IMY), imy.se.",
    ],
  },
  {
    title: "Kakor",
    body: [
      "Vi använder bara det som krävs för att du ska kunna vara inloggad. Inga spårnings- eller reklamkakor.",
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 md:py-20">
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
      <PublicFooter />
    </div>
  );
}
