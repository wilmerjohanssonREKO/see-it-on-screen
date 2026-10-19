import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth, useIsAdmin, useMySchoolId } from "@/hooks/useAuth";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`}>
      <span className="rounded-xl bg-primary px-3.5 py-1.5 font-display text-lg font-extrabold tracking-tight text-primary-foreground shadow-soft">
        REKO UF
      </span>
    </Link>
  );
}

export function AppHeader() {
  const { session } = useAuth();
  const { data: isAdmin } = useIsAdmin(session?.user.id);
  const { data: schoolId } = useMySchoolId(session?.user.id);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Brand />
        <nav className="flex items-center gap-1 text-sm">
          {!session && (
            <Link to="/kontakt" className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
              Kontakt
            </Link>
          )}
          {session ? (
            <>
              {schoolId ? (
                <Link
                  to="/skola"
                  className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  Vikariebehov
                </Link>
              ) : (
                <>
              <Link
                to="/uppdrag"
                className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                Schema
              </Link>
              <Link
                to="/profil"
                className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                Min profil
              </Link>
                </>
              )}
              <Link
                to="/feedback"
                className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                Feedback
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  Admin
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logga ut</span>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Logga in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
