# GCP Pre-release Deployment

Target awal:

- Project ID: `workshopmu`
- Region: `asia-southeast2`
- API: Cloud Run
- Frontend: Firebase Hosting
- Database: Cloud SQL PostgreSQL `db-f1-micro`
- Payment: disabled via `PAYMENT_ENABLED=false`

## Run From Cloud Shell

1. Open Google Cloud Shell in project `workshopmu`.
2. Clone the repo and checkout the pre-release branch.
3. Run:

```bash
export PROJECT_ID=workshopmu
export REGION=asia-southeast2
export FRONTEND_URL=https://workshopmu.web.app
bash scripts/gcp/deploy-pre-release.sh
```

Optional budget alert:

```bash
export BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX
export BUDGET_AMOUNT=20
export BUDGET_EMAIL=you@example.com
bash scripts/gcp/deploy-pre-release.sh
```

## Smoke Test

After deploy, copy the Cloud Run API URL and run:

```bash
export API_URL=https://wms-api-pre-xxxxx.a.run.app
bash scripts/gcp/smoke-test.sh
```

## Acceptance Checklist

- Cloud Run `/health` returns `ok`.
- Firebase Hosting opens the web app.
- New tenant registration works.
- New tenant login works.
- Tenant A data is not visible to tenant B.
- Payment remains disabled.
- Cloud SQL backups are enabled.
- Budget alert is configured manually or through the script.

## Upgrade Trigger

Stay on `db-f1-micro` while the app is in a small pilot. Upgrade to `db-g1-small` when:

- Cloud SQL memory/CPU is frequently high.
- API logs show connection timeout or pool timeout.
- More than 3-5 tenants are active daily.
- Reports or booking pages become noticeably slow.
