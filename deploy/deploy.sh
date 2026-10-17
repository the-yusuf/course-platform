#!/usr/bin/env bash
# Deploys one commit: pulls the images GitHub Actions built and tested for it, runs
# the migrations and restarts the API. GitHub runs it over SSH after every push to
# main (.github/workflows/ci.yml). By hand, on the server:
#   ~/course-platform/deploy/deploy.sh            the latest commit on main
#   ~/course-platform/deploy/deploy.sh <commit>   a given one, e.g. to roll back
set -euo pipefail

image=ghcr.io/the-yusuf/course-platform # the same name as in compose.yaml

# Everything runs inside main, which bash reads in full before starting:
# the git checkout below may replace this very file.
main() {
  cd "$(dirname "$0")/.." # the folder with compose.yaml

  exec 9> /tmp/course-platform-deploy.lock
  flock --nonblock 9 || fail "another deploy is running"

  # GitHub's deploy key can only run this script, and ssh hands its argument over here
  local commit="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  [[ -z $commit || $commit =~ ^[0-9a-f]{40}$ ]] ||
    fail "expected a full 40-character commit hash, got '$commit'"
  git fetch --quiet origin main
  commit="${commit:-$(git rev-parse origin/main)}"
  git merge-base --is-ancestor "$commit" origin/main 2> /dev/null ||
    fail "$commit is not a commit on main"

  # Pulled before anything changes, so a failed pull leaves the server as it was
  local kind
  for kind in api migrate; do
    docker pull --quiet "$image:$kind-$commit" > /dev/null ||
      fail "can't pull $image:$kind-$commit. Has CI finished for this commit?" \
        "The first time, make the package public: GitHub > Packages > course-platform > Package settings."
  done

  # compose.yaml and the deploy scripts now match the images
  git checkout --quiet --detach "$commit"

  # The containers always run the "-current" tags, so a later `docker compose up -d`
  # (after editing .env, say) uses what was deployed instead of building.
  for kind in api migrate; do
    docker tag "$image:$kind-$commit" "$image:$kind-current"
    docker image rm "$image:$kind-$commit" > /dev/null # removes only the extra tag
  done

  # Migrates, then replaces the API: about 3 seconds of downtime.
  # If a migration fails, the deploy stops here.
  docker compose up -d --no-build

  local attempt
  for attempt in $(seq 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
      docker image prune -f > /dev/null # the previous images
      docker compose ps
      echo "deploy: $commit is live"
      return
    fi
    sleep 2
  done
  docker compose logs --tail 40 api >&2
  fail "the API is not healthy after $((attempt * 2)) s (logs above)"
}

fail() {
  printf 'deploy: %s\n' "$@" >&2
  exit 1
}

main "$@"; exit # one line: bash has parsed the exit before main runs
