#!/usr/bin/env bash
# Local stand-in for a Supabase project: Postgres (port 5499) + Auth + PostgREST + a gateway on :54321
# + a mail catcher. Binaries live in /var/tmp/sbstack (PostgREST and supabase/auth GitHub releases).
# Usage: tests/localstack/up.sh   (rebuilds the "sb" database from replica/schema.sql each time)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../.." && pwd); BIN=/var/tmp/sbstack
SECRET=local-dev-jwt-secret-with-at-least-32-chars
PSQL="psql -h /var/tmp/pgtest -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
for p in 9999 3001 54321 2500; do fuser -k $p/tcp >/dev/null 2>&1 || true; done
# Local Postgres (cluster in /var/tmp/pgtest/data, owned by postgres): start it if it isn't running.
if ! pg_isready -h /var/tmp/pgtest -p 5499 -q; then
  su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgtest/data -l /var/tmp/pgtest/log -o '-p 5499 -k /var/tmp/pgtest' start" >/dev/null 2>&1 < /dev/null
  for i in $(seq 1 30); do pg_isready -h /var/tmp/pgtest -p 5499 -q && break; sleep 0.5; done
fi
$PSQL -d postgres -c "drop database if exists sb" -c "create database sb"
$PSQL -d sb -f "$HERE/roles.sql"
: > "$BIN/mail.jsonl"
(cd "$BIN" && GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:local@127.0.0.1:5499/sb?search_path=auth" \
  GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
  GOTRUE_JWT_SECRET=$SECRET GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 \
  GOTRUE_SMTP_ADMIN_EMAIL=noreply@local.test GOTRUE_SMTP_SENDER_NAME="Team App" GOTRUE_SMTP_MAX_FREQUENCY=1s \
  GOTRUE_RATE_LIMIT_EMAIL_SENT=10000 GOTRUE_RATE_LIMIT_VERIFY=10000 GOTRUE_RATE_LIMIT_OTP=10000 GOTRUE_EXTERNAL_PHONE_ENABLED=false \
  GOTRUE_MAILER_OTP_EXP=3600 GOTRUE_LOG_LEVEL=warn \
  nohup ./auth > "$BIN/auth.log" 2>&1 < /dev/null &)
python3 "$HERE/mailsink.py" "$BIN/mail.jsonl" > "$BIN/mail.log" 2>&1 < /dev/null &
for i in $(seq 1 60); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 0.5; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { tail -20 "$BIN/auth.log"; exit 1; }
$PSQL -d sb -f "$HERE/after_auth.sql"
$PSQL -d sb -f "$REPO/replica/schema.sql"
cat > "$BIN/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:local@127.0.0.1:5499/sb"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3001
server-host = "127.0.0.1"
CONF
(cd "$BIN" && nohup ./postgrest postgrest.conf > "$BIN/postgrest.log" 2>&1 < /dev/null &)
node "$HERE/gateway.mjs" > "$BIN/gateway.log" 2>&1 < /dev/null &
for i in $(seq 1 40); do curl -sf http://127.0.0.1:3001/ >/dev/null && break; sleep 0.5; done
ANON=$(node "$HERE/jwt.mjs" $SECRET anon); SERVICE=$(node "$HERE/jwt.mjs" $SECRET service_role)
cat > "$REPO/.env.localstack" <<ENV
DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
APP_URL=http://localhost:3000
DEV_OUTBOX=1
ENV
echo "local Supabase up: http://localhost:54321 (env in .env.localstack, mail in $BIN/mail.jsonl)"
