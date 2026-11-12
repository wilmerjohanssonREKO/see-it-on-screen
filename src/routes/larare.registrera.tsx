import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/AppHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/larare/registrera")({
  head: () => ({ meta: [{ title: "Lärarkonto med personlig inbjudan — REKO UF" }] }),
  component: TeacherSignup,
});
function TeacherSignup() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lärarkonto via personlig inbjudan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p>
            Kontakta REKO för en personlig inbjudan till din skola. Du verifierar din e-postadress
            och väljer själv lösenord. Gemensamma skolkoder används inte längre för nya konton.
          </p>
          <Button asChild>
            <Link to="/auth">Logga in på befintligt konto</Link>
          </Button>
          <a href="mailto:hej@rekoweb.com" className="text-sm underline">
            Kontakta REKO
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
