import { Link } from "@tanstack/react-router";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-8">
        <span className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} REKO UF
        </span>
        <a href="mailto:hej@rekoweb.com" className="text-sm underline underline-offset-2">hej@rekoweb.com</a>
        <Link to="/integritetspolicy" className="text-sm underline underline-offset-2">Integritetspolicy</Link>
      </div>
    </footer>
  );
}
