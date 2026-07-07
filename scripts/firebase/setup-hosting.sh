#!/usr/bin/env bash
# One-time Firebase Hosting setup for nausheen-fruits-new
# Creates hosting sites and maps deploy targets (customer, admin).
set -euo pipefail

PROJECT="nausheen-fruits-new"
CUSTOMER_SITE="nausheen-customer"
ADMIN_SITE="nausheen-admin"

echo "Firebase Hosting one-time setup — project: ${PROJECT}"
echo ""

if ! command -v firebase >/dev/null 2>&1; then
  echo "Install Firebase CLI: npm install -g firebase-tools"
  exit 1
fi

firebase login
firebase use "${PROJECT}"

echo "Enabling webframeworks experiment (required for Next.js SSR hosting)..."
npx firebase experiments:enable webframeworks --project "${PROJECT}" || firebase experiments:enable webframeworks

create_site() {
  local site_id="$1"
  if firebase hosting:sites:list --project "${PROJECT}" 2>/dev/null | grep -q "${site_id}"; then
    echo "Site ${site_id} already exists."
  else
    firebase hosting:sites:create "${site_id}" --project "${PROJECT}"
  fi
}

create_site "${CUSTOMER_SITE}"
create_site "${ADMIN_SITE}"

firebase target:apply hosting customer "${CUSTOMER_SITE}" --project "${PROJECT}"
firebase target:apply hosting admin "${ADMIN_SITE}" --project "${PROJECT}"

echo ""
echo "Targets applied. .firebaserc should contain:"
echo '  "customer": ["nausheen-customer"]'
echo '  "admin": ["nausheen-admin"]'
echo ""
echo "Next — connect custom domains in Firebase Console:"
echo "  Customer: https://nausheenfruitjuicecenter.com"
echo "  Admin:    https://admin.nausheenfruitjuicecenter.com"
echo ""
echo "Then run: npm run deploy:all"
