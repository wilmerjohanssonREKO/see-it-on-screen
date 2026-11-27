# Local browser pilot model

Runs distinct synthetic school/substitute/admin accounts in isolated real Chromium browser contexts against the local full pilot stack. Never targets external URLs. Browser requests to external hosts are blocked. No real credentials are accepted: manifest addresses must use `.invalid` or `example.test`.

The initial model uses five simultaneous contexts: two schools, two substitutes and one REKO admin. Each school publishes through the UI. Its paired substitute applies, withdraws, reapplies, sees selection/contacts and requests cancellation. REKO approves through the UI, the school sees the reopened job, and the queue captures cancellation notices. This sequence intentionally delays dispatch until after cancellation: obsolete booking confirmations must be cancelled, not delivered. Coordination events organize these related tasks; they are measured separately from app wait times.

## Run

Requires Python 3 with `playwright`, Chromium, Docker access and a running seeded full local stack. No packages are installed by this script.

```sh
python run.py --manifest /path/to/local/runtime/manifest.json --users 5
```

Defaults use realistic **assumed** think times (read 2–8 s, write 15–45 s, navigate 1–4 s), deterministic per-actor seed 20261113. `--think-scale 0.1` accelerates a smoke check and is explicitly recorded; it is not a realistic timing measurement.

Reset the isolated fixture dataset before each stage or rerun, so school cards remain unambiguous and each stage starts from the same seed. A duplicate-card selector fails closed. Only the selected stage runs. Nothing automatically increases load. Use `--users 10` after fixture provisioning and a successful preceding stage. Current runner is limited to 2 CPU/8 GiB; the configured cap is ten contexts. Inspect browser/app resource saturation and provision more fixtures before increasing that cap; `model.json` lists proposed later 50/100/250 stages, not implemented or verified capacity. More contexts need unique fixture identities; the script refuses account reuse. For an even-sized cohort the spare user browses and checks denied admin access.

Manifest (keep private, never commit generated secrets):

```json
{
  "app_url": "http://127.0.0.1:5182",
  "api_url": "http://127.0.0.1:54461",
  "docker_db": "reko-pilot-full-db",
  "database": "postgres",
  "accounts": [
    {"role":"school","email":"school1@pilot.invalid","password":"generated-local-only","school_name":"Pilot School 1"},
    {"role":"substitute","email":"sub1@pilot.invalid","password":"generated-local-only","name":"Pilot Substitute 1"}
  ]
}
```

Two school/substitute pairs and at least one admin are required for the initial five-user run. School identities must belong to separate schools. All fixtures must be in sandbox with complete contact details and substitutes approved. App and API URLs must name loopback; backend integrity queries require a `reko-pilot-*` local DB container.

## Evidence and interpretation

Each private artifact directory contains `result.json` with events per role, actual scripted DOM click count and separately accepted native confirmation dialogs, request paths/durations without queries or bodies, task wall time, assumed think time, measured DOM wait time, input/navigation time and scenario coordination wait. p50/p95 here summarize DOM readiness waits, **not an API response-time SLA**. Task times include assumptions and do not establish human usability. Two browser contexts record video by default; increase with `--record-users` only within storage budget.

Optional `--traces` records representative traces after login. Traces can include **local fixture session tokens**; they stay in ignored private artifacts and must not be committed or published. Video and results contain synthetic identities only. Expire/reset the local stack after use. Passwords and raw exception messages are never serialized in the report.

Pass gates: every user completes required tasks; no JavaScript page errors; exactly the expected published/reopened assignments and approved cancellations; exactly two captured cancellation messages and two cancelled obsolete booking confirmations per pair, with no unexpected template/status combination; zero non-test school assignments, overlapping allocations, external sends or pending queue items. Any failed worker cancels the stage. A 15 minute stage timeout bounds runs; one action has a 30 second timeout and cross-role synchronization a 180 second timeout. These are initial stop limits, not production targets.

This first model does not yet prove invite/signup/recovery mail, private Storage access, stale identities, API error injection, provider delivery, long soak operation or maximum deployment capacity. Those are separate integration suites and later test stages. A local pass must not be presented as production-capacity validation.

Reset between stages with `python reset.py --manifest /path/to/local/runtime/manifest.json`. The reset requires the exact dedicated DB/container, pilot owner labels, only test schools and only `pilot-%` jobs; otherwise it refuses. Auth/profile fixtures and prior run artifacts are preserved.

## Validated runtime scope

The current app runs through the **Vite development server** on a shared 2 CPU/8 GiB executor. These timings are not production-build, Lovable-hosting or maximum-capacity measurements. The first five- and ten-user stages used real local GoTrue Auth, PostgreSQL/PostgREST and Mailpit. Storage is explicitly **not ready** in this executor (its route returns503); Storage scenarios remain blocked. App sandbox notices are captured in the database, while Auth mail stays in Mailpit. Optional browser videos use the installed system `ffmpeg` through a private per-run Playwright runtime path; no runtime binaries or tokens are committed.
