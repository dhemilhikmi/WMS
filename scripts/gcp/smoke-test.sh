#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-}"
if [[ -z "${API_URL}" ]]; then
  echo "Set API_URL first, e.g. API_URL=https://wms-api-pre-xxxxx.a.run.app ./scripts/gcp/smoke-test.sh"
  exit 1
fi

echo "Checking API health..."
curl -fsS "${API_URL}/health"
echo

STAMP="$(date +%Y%m%d%H%M%S)"
PASSWORD="Password123!"

register() {
  local label="$1"
  curl -fsS -X POST "${API_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenantName\":\"QA Tenant ${label} ${STAMP}\",
      \"tenantEmail\":\"qa-tenant-${label}-${STAMP}@example.com\",
      \"email\":\"qa-${label}-${STAMP}@example.com\",
      \"name\":\"QA Admin ${label}\",
      \"password\":\"${PASSWORD}\"
    }" >/tmp/wms-register-${label}.json
}

login() {
  local label="$1"
  curl -fsS -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"qa-${label}-${STAMP}@example.com\",\"password\":\"${PASSWORD}\"}"
}

echo "Registering two QA tenants..."
register "A"
register "B"

echo "Logging in..."
A_LOGIN="$(login A)"
B_LOGIN="$(login B)"

A_TOKEN="$(python3 - <<PY
import json
print(json.loads('''${A_LOGIN}''')['data']['token'])
PY
)"
B_TOKEN="$(python3 - <<PY
import json
print(json.loads('''${B_LOGIN}''')['data']['token'])
PY
)"

auth_get() {
  local token="$1"
  local path="$2"
  curl -fsS -H "Authorization: Bearer ${token}" "${API_URL}${path}"
}

auth_post() {
  local token="$1"
  local path="$2"
  local body="$3"
  curl -fsS -X POST "${API_URL}${path}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "${body}"
}

echo "Creating supplier in tenant A..."
SUPPLIER_A="$(auth_post "${A_TOKEN}" "/api/suppliers" "{\"nama\":\"QA Supplier ${STAMP}\",\"kategori\":\"Material\"}")"
SUPPLIER_NAME="$(python3 - <<PY
import json
print(json.loads('''${SUPPLIER_A}''')['data']['nama'])
PY
)"

echo "Checking tenant B cannot see tenant A supplier..."
SUPPLIERS_B="$(auth_get "${B_TOKEN}" "/api/suppliers")"
python3 - <<PY
import json, sys
name = "${SUPPLIER_NAME}"
rows = json.loads('''${SUPPLIERS_B}''')['data']
if any(row.get('nama') == name for row in rows):
    print("FAIL: tenant B can see tenant A supplier")
    sys.exit(1)
print("PASS: supplier isolation")
PY

echo "Smoke test passed."
