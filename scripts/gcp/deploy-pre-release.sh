#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-workshopmu}"
REGION="${REGION:-asia-southeast2}"
INSTANCE_NAME="${INSTANCE_NAME:-wms-db-pre}"
DB_NAME="${DB_NAME:-workshop_system}"
DB_USER="${DB_USER:-wms_app}"
REPOSITORY="${REPOSITORY:-wms}"
API_SERVICE="${API_SERVICE:-wms-api-pre}"
IMAGE_NAME="${IMAGE_NAME:-wms-api}"
FRONTEND_URL="${FRONTEND_URL:-https://${PROJECT_ID}.web.app}"
PAYMENT_ENABLED="${PAYMENT_ENABLED:-false}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"
BUDGET_EMAIL="${BUDGET_EMAIL:-}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI tidak ditemukan. Jalankan script ini dari Google Cloud Shell."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm tidak ditemukan. Cloud Shell biasanya sudah punya Node/npm."
  exit 1
fi

echo "Project  : ${PROJECT_ID}"
echo "Region   : ${REGION}"
echo "DB       : ${INSTANCE_NAME}/${DB_NAME}"
echo "API      : ${API_SERVICE}"
echo "Frontend : ${FRONTEND_URL}"

gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"

echo "Enabling required Google Cloud services..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com

echo "Creating Artifact Registry repository if needed..."
if ! gcloud artifacts repositories describe "${REPOSITORY}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="WorkshopMu pre-release images"
fi

echo "Creating Cloud SQL instance if needed..."
if ! gcloud sql instances describe "${INSTANCE_NAME}" >/dev/null 2>&1; then
  gcloud sql instances create "${INSTANCE_NAME}" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-type=SSD \
    --storage-size=10 \
    --backup-start-time=18:00 \
    --availability-type=zonal \
    --edition=ENTERPRISE
fi

echo "Creating Cloud SQL database if needed..."
if ! gcloud sql databases describe "${DB_NAME}" --instance="${INSTANCE_NAME}" >/dev/null 2>&1; then
  gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE_NAME}"
fi

DB_PASSWORD="$(openssl rand -base64 24 | tr -d '\n' | tr '/+' 'Aa')"
JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"

echo "Creating/updating database user..."
if gcloud sql users describe "${DB_USER}" --instance="${INSTANCE_NAME}" >/dev/null 2>&1; then
  gcloud sql users set-password "${DB_USER}" --instance="${INSTANCE_NAME}" --password="${DB_PASSWORD}"
else
  gcloud sql users create "${DB_USER}" --instance="${INSTANCE_NAME}" --password="${DB_PASSWORD}"
fi

DATABASE_URL="$(python3 - <<PY
from urllib.parse import quote
user = quote("${DB_USER}")
password = quote("${DB_PASSWORD}")
db = quote("${DB_NAME}")
host = "/cloudsql/${INSTANCE_CONNECTION_NAME}"
print(f"postgresql://{user}:{password}@localhost/{db}?host={host}&connection_limit=1&pool_timeout=20")
PY
)"

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" >/dev/null 2>&1; then
    printf "%s" "${value}" | gcloud secrets versions add "${name}" --data-file=-
  else
    printf "%s" "${value}" | gcloud secrets create "${name}" --data-file=-
  fi
}

echo "Writing secrets to Secret Manager..."
upsert_secret "wms-database-url-pre" "${DATABASE_URL}"
upsert_secret "wms-jwt-secret-pre" "${JWT_SECRET}"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:pre-release"

echo "Building and pushing API image..."
gcloud builds submit ./api --tag "${IMAGE_URI}"

echo "Deploying API to Cloud Run..."
gcloud run deploy "${API_SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=10 \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=wms-database-url-pre:latest,JWT_SECRET=wms-jwt-secret-pre:latest" \
  --set-env-vars="NODE_ENV=production,PORT=8080,API_PORT=8080,JWT_EXPIRY=7d,FRONTEND_URL=${FRONTEND_URL},PAYMENT_ENABLED=${PAYMENT_ENABLED},ROOT_DOMAIN=${PROJECT_ID}.web.app,MAIN_DOMAIN=${PROJECT_ID}.web.app"

API_URL="$(gcloud run services describe "${API_SERVICE}" --region="${REGION}" --format='value(status.url)')"
echo "API URL: ${API_URL}"

echo "Running Prisma migrations through a Cloud Run job..."
MIGRATION_JOB="${API_SERVICE}-migrate"
if gcloud run jobs describe "${MIGRATION_JOB}" --region="${REGION}" >/dev/null 2>&1; then
  gcloud run jobs delete "${MIGRATION_JOB}" --region="${REGION}" --quiet
fi
gcloud run jobs create "${MIGRATION_JOB}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --memory=512Mi \
  --cpu=1 \
  --max-retries=1 \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=wms-database-url-pre:latest,JWT_SECRET=wms-jwt-secret-pre:latest" \
  --set-env-vars="NODE_ENV=production,PAYMENT_ENABLED=${PAYMENT_ENABLED}" \
  --command=npm \
  --args=run,prisma:deploy
gcloud run jobs execute "${MIGRATION_JOB}" --region="${REGION}" --wait

echo "Building frontend..."
(
  cd web
  npm ci
  VITE_API_URL="${API_URL}" npm run build
)

echo "Deploying Firebase Hosting..."
if ! firebase --version >/dev/null 2>&1; then
  npm install -g firebase-tools
fi
firebase use "${PROJECT_ID}" --non-interactive
firebase deploy --only hosting --project "${PROJECT_ID}"

if [[ -n "${BILLING_ACCOUNT_ID}" && -n "${BUDGET_AMOUNT}" && -n "${BUDGET_EMAIL}" ]]; then
  echo "Creating budget alert..."
  gcloud billing budgets create \
    --billing-account="${BILLING_ACCOUNT_ID}" \
    --display-name="WorkshopMu pre-release budget" \
    --budget-amount="${BUDGET_AMOUNT}USD" \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    --notification-email="${BUDGET_EMAIL}" || true
else
  echo "Budget alert skipped. Set BILLING_ACCOUNT_ID, BUDGET_AMOUNT, and BUDGET_EMAIL to create it automatically."
fi

echo "Deployment complete."
echo "API health: ${API_URL}/health"
echo "Frontend : ${FRONTEND_URL}"
