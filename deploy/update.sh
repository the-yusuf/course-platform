#!/usr/bin/env bash
# Deploys the latest code from GitHub. Run it on the server after you push:
#   ~/course-platform/deploy/update.sh
set -euo pipefail

cd "$(dirname "$0")/.." # the folder with compose.yaml

git pull --ff-only
# Builds the new images while the old API keeps serving, then stops it, runs
# migrations and starts the new API: about 3 seconds of downtime. If a migration
# fails, it is rolled back and the API stays stopped: fix it, push, run this again.
docker compose up -d --build
docker image prune -f > /dev/null # remove the previous images
docker compose ps
