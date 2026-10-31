import { createFileRoute } from "@tanstack/react-router";
import { DataTab } from "@/components/admin/DataTab";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentsTab } from "@/components/admin/AssignmentsTab";
import { SubstitutesTab } from "@/components/admin/SubstitutesTab";
import { RatingsTab } from "@/components/admin/RatingsTab";
import { SchoolsTab } from "@/components/admin/SchoolsTab";
import { FeedbackTab } from "@/components/admin/FeedbackTab";
import { TeachersTab } from "@/components/admin/TeachersTab";
import { SandboxTab } from "@/components/admin/SandboxTab";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Adminpanel — REKO UF" },
      {
        name: "description",
        content:
          "Lägg upp vikariebehov, godkänn vikarier, hantera skolkonton och lärare i REKO UF:s adminpanel.",
      },
      { property: "og:title", content: "Adminpanel — REKO UF" },
      { property: "og:description", content: "Intern översikt för REKO UF-teamet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin(session?.user.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="p-8 text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Endast för REKO UF-teamet</h1>
          <p className="mt-2 text-muted-foreground">Ditt konto har inte adminbehörighet.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Adminpanel</h1>
        <p className="mt-1 text-muted-foreground">Hantera behov, vikarier, skolor och lärare.</p>
        <Tabs defaultValue="behov" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="behov">Vikariebehov</TabsTrigger>
            <TabsTrigger value="vikarier">Vikarier</TabsTrigger>
            <TabsTrigger value="skolor">Skolor</TabsTrigger>
            <TabsTrigger value="larare">Lärare</TabsTrigger>
            <TabsTrigger value="betyg">Betyg</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="sandlada">Sandlåda</TabsTrigger>
          </TabsList>
          <TabsContent value="behov">
            <AssignmentsTab />
          </TabsContent>
          <TabsContent value="vikarier">
            <SubstitutesTab />
          </TabsContent>
          <TabsContent value="skolor">
            <SchoolsTab />
          </TabsContent>
          <TabsContent value="larare">
            <TeachersTab />
          </TabsContent>
          <TabsContent value="betyg">
            <RatingsTab />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackTab />
          </TabsContent>
          <TabsContent value="data">
            <DataTab />
          </TabsContent>
          <TabsContent value="sandlada">
            <SandboxTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Vikariebehov ---------------- */
