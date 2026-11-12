#!/usr/bin/env bash
# Disposable LOCAL database only. Never reads .env or accepts a remote DB URL.
set -euo pipefail
cd "$(dirname "$0")/.."
docker_cli=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
container="reko-sql-test-$$"
cleanup() { "${docker_cli[@]}" rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${docker_cli[@]}" run -d --name "$container" -e POSTGRES_PASSWORD=local-fixture-only -e POSTGRES_DB=reko_test postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if "${docker_cli[@]}" exec "$container" pg_isready -h 127.0.0.1 -U postgres -d reko_test >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 30 ]]; then echo 'Local PostgreSQL did not become ready' >&2; exit 1; fi
  sleep 1
done
sql() { "${docker_cli[@]}" exec -i "$container" psql -X -U postgres -d reko_test --single-transaction -v ON_ERROR_STOP=1 "$@"; }
sql < tests/bootstrap.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  # The old seed contains unrelated fixture data and is not a schema migration.
  [[ "$migration" == *seed_test_data.sql ]] && continue
  echo "Applying $migration"
  sql < "$migration" >/dev/null
done
for migration in drizzle/migrations/*.sql; do
  echo "Applying $migration"
  sql < "$migration" >/dev/null
done
shopt -s nullglob
for test_file in tests/*.sql; do
  [[ "$test_file" == tests/bootstrap.sql ]] && continue
  echo "Testing $test_file"
  sql < "$test_file"
done
bash scripts/test-db-concurrency.sh "$container"
echo 'All local migration and SQL integration checks passed.'
