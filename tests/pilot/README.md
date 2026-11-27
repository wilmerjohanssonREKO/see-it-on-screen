# REKO pilot tooling

Read `docs/pilot-test-model.md` first. These tools target a disposable LOCAL pilot;
never use the real Lovable backend or original user credentials.

1. Start the separate environment in one terminal:

   ```sh
   REKO_PILOT_SOURCE="$PWD" python tests/pilot/fullstack/stack.py --without-storage
   ```

2. Verify real Auth and application recovery with internal mail capture:

   ```sh
   mkdir -p tests/pilot/artifacts
   python tests/pilot/auth/recovery.py --manifest tests/pilot/fullstack/runtime/manifest.json --output tests/pilot/artifacts/auth.json
   ```

3. Run five real browser contexts with assumed human pauses:

   ```sh
   python tests/pilot/browser/run.py --manifest tests/pilot/fullstack/runtime/manifest.json --users 5 --think-scale 1 --record-users 0
   ```

   See browser/README.md for recording, summaries and the next ten-user stage.
   Reset only dedicated synthetic pilot jobs between runs. Do not reuse fixture
   sessions concurrently across actors.

4. Sample executor resources in a separate process while testing:

   ```sh
   python tests/pilot/resource_monitor.py --output tests/pilot/artifacts/resources.json
   ```

   Ctrl+C stops sampling. Process RSS sums can double-count shared pages; cgroup
   memory is the aggregate measure. The app and generator share this executor,
   so saturation cannot be attributed to the deployed website alone.

Dependencies are Python3/Playwright, Chromium, Node dependencies for REKO and a
local Docker daemon. Versions used initially: Python3.12.14, Playwright1.62.0,
PostgreSQL17, PostgREST13.0.5, GoTrue2.183.0 and Mailpit1.27.8. Official container
tags are pinned in fullstack/stack.py; record the actual code version and model
for each run. Tools never install dependencies implicitly.

The explicit initial mode has real Auth/PostgREST/DB/SMTP capture but only a
Storage schema test double. Actual file operations return503. Private-file tests
remain BLOCKED, not passed. Full Storage is required before a complete pilot is
approved. All timings are local and include a Docker-exec HTTP gateway. They are
not evidence of hosted capacity or a human usability study.

Runtime manifests, mailbox content, session artifacts and videos are private and
ignored by Git. Publish only inspected synthetic result JSON and derived reports.
