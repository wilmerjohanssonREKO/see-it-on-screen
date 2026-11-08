import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth, useIsAdmin, useMySchoolId, useProfile } from "@/hooks/useAuth";
import { SubstituteAvatar } from "@/components/SubstituteAvatar";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`}>
      <span className="rounded-xl bg-primary px-3.5 py-1.5 font-display text-lg font-extrabold tracking-tight text-primary-foreground shadow-soft">
        REK<span className="text-accent">O</span> UF
      </span>
    </Link>
  );
}

export function AppHeader() {
  const { session } = useAuth();
  const { data: isAdmin } = useIsAdmin(session?.user.id);
  const { data: schoolId } = useMySchoolId(session?.user.id);
  const { data: profile } = useProfile(session?.user.id);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const navClass = "flex min-h-11 items-center rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
  async function signOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Brand />
        <nav aria-label="Huvudnavigation" className="hidden items-center gap-1 text-sm md:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:inline-flex">
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
              {!schoolId && !isAdmin && (
                <Link to="/profil" aria-label="Min profil" className="ml-1">
                  <SubstituteAvatar id={session.user.id} name={profile?.full_name} className="h-8 w-8 text-xs" />
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logga ut</span>
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="min-h-11">
              <Link to="/auth">Logga in</Link>
            </Button>
          )}
        </nav>
        <nav aria-label="Mobilnavigation" className="flex items-center gap-1 text-sm md:hidden">
          {session ? (
            <>
              <Link to={schoolId ? "/skola" : "/uppdrag"} className={navClass} activeProps={{ className: "bg-secondary text-foreground" }}>
                {schoolId ? "Vikariebehov" : "Schema"}
              </Link>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={menuOpen ? "Stäng meny" : "Öppna meny"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
                <Menu className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/kontakt" className={navClass} activeProps={{ className: "bg-secondary text-foreground" }}>Kontakt</Link>
              <Button asChild size="sm" className="min-h-11"><Link to="/auth">Logga in</Link></Button>
            </>
          )}
        </nav>
      </div>
      {session && menuOpen && (
        <nav id="mobile-navigation" aria-label="Fler sidor" className="grid gap-1 border-t border-border px-4 py-3 text-sm md:hidden" onKeyDown={(event) => {
          if (event.key === "Escape") {
            setMenuOpen(false);
            document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();
          }
        }}>
          {!schoolId && <Link to="/profil" className={navClass} onClick={() => setMenuOpen(false)} activeProps={{ className: "bg-secondary text-foreground" }}>Min profil</Link>}
          <Link to="/feedback" className={navClass} onClick={() => setMenuOpen(false)} activeProps={{ className: "bg-secondary text-foreground" }}>Feedback</Link>
          {isAdmin && <Link to="/admin" className={navClass} onClick={() => setMenuOpen(false)} activeProps={{ className: "bg-secondary text-foreground" }}>Admin</Link>}
          <Button variant="ghost" className="min-h-11 justify-start" onClick={signOut}><LogOut className="h-4 w-4" /> Logga ut</Button>
        </nav>
      )}
    </header>
  );
}
