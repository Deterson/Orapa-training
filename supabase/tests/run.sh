#!/usr/bin/env bash
# Tests SQL de la sécurité par ligne. Crée une base jetable, y applique l'amorce de test puis les
# migrations dans l'ordre, lance chaque fichier de supabase/tests/*.test.sql, supprime la base.
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres bash supabase/tests/run.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
admin_url="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
db="orapa_test_$$"
# Même serveur, autre base : on remplace le dernier segment de l'adresse.
test_url="${admin_url%/*}/$db"

psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "create database $db"
trap 'psql "$admin_url" -q -c "drop database if exists $db" >/dev/null 2>&1 || true' EXIT

run() { psql "$test_url" -v ON_ERROR_STOP=1 -q -X -f "$1"; }

run supabase/tests/00_bootstrap.sql
for migration in supabase/migrations/*.sql; do
  echo "migration : $migration"
  run "$migration"
done
run supabase/tests/01_helpers.sql
status=0
for test in supabase/tests/*.test.sql; do
  echo "test : $test"
  run "$test" || status=1
done
exit $status
