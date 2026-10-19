export function PolicyCheckbox() {
  return (
    <label className="flex items-start gap-2 text-sm font-medium text-foreground">
      <input
        type="checkbox"
        name="policy"
        required
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span>
        Jag godkänner REKO UF:s{" "}
        <a
          href="/integritetspolicy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline underline-offset-2"
        >
          integritetspolicy
        </a>
      </span>
    </label>
  );
}
