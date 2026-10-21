export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <span className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} REKO UF
        </span>
      </div>
    </footer>
  );
}
