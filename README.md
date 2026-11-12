# REKO UF

Digital vikariehantering för gymnasieskolor. Skolan publicerar ett behov, godkända
vikarier anmäler intresse och skolan väljer. Skolan ansvarar för anställning och lön.

React/TanStack Start frontend and server functions, Supabase Auth/PostgreSQL/private
Storage, Lovable hosting and transactional email. The connected project is
https://lovable.dev/projects/f81926f4-49d3-4864-91c8-f2451201fe91.

## Development and checks

Use Bun 1.4.4 and the committed lockfile:

```sh
bun install --frozen-lockfile
bun run dev
bun run build
bun run typecheck
bun run test:unit
bun run test:db
```

The database check requires local Docker. It creates and removes a disposable
PostgreSQL container; it never accepts a production connection string. Unit checks
exclude the old live integration test. CI runs build, types, unit and local SQL checks.

Read AGENTS.md before changes and docs/rollout.md before merging/deployment. Commits
on the connected main branch sync into Lovable: preserve pushed history and deploy
schema and application changes together. New migration files do not automatically
prove that the connected database has applied them.

Runtime credentials belong in hosting settings. .env.example documents names only.
Never commit passwords, service-role keys, auth sessions or private invitations.
