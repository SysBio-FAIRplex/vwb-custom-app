#!/bin/bash
# Best-effort Workbench identity resolution, then start the app server.
#
# We mirror how Workbench's own full-featured apps authenticate the `wb` CLI:
# use the pet service account's application-default credentials (available from
# the GCE metadata server) and the terra-* instance metadata to point the CLI
# at the right server + workspace, then read the user's email from
# `wb workspace describe`. Everything here is non-fatal — if the CLI is missing,
# the metadata server is unreachable, or auth is blocked, we write
# status="unavailable" and the UI asks the user to type their details instead.

set -u

IDENTITY_FILE="${IDENTITY_FILE:-/app/identity.json}"

# Start in "pending" so the UI shows a spinner while resolution runs.
printf '{"status":"pending"}' > "${IDENTITY_FILE}" 2>/dev/null || true

resolve_identity() {
  local md="http://metadata.google.internal/computeMetadata/v1"
  local hdr="Metadata-Flavor: Google"
  local project petSa server workspace email status

  project="$(curl -s --max-time 3 -H "${hdr}" "${md}/project/project-id" 2>/dev/null || true)"
  petSa="$(curl -s --max-time 3 -H "${hdr}" "${md}/instance/service-accounts/default/email" 2>/dev/null || true)"
  server="$(curl -s --max-time 3 -H "${hdr}" "${md}/instance/attributes/terra-cli-server" 2>/dev/null || true)"
  workspace="$(curl -s --max-time 3 -H "${hdr}" "${md}/instance/attributes/terra-workspace-id" 2>/dev/null || true)"

  email=""
  if command -v wb >/dev/null 2>&1 && [ -n "${server}" ]; then
    wb server set --quiet --name "${server}" >/dev/null 2>&1 || true
    wb auth login --mode APP_DEFAULT_CREDENTIALS >/dev/null 2>&1 || true
    [ -n "${workspace}" ] && wb workspace set --id "${workspace}" >/dev/null 2>&1 || true
    email="$(wb workspace describe --format=json 2>/dev/null | jq -r '.userEmail // empty' 2>/dev/null || true)"
    if [ -z "${email}" ]; then
      email="$(wb auth status --format=json 2>/dev/null | jq -r '.userEmail // empty' 2>/dev/null || true)"
    fi
  fi

  if [ -n "${email}" ]; then status="resolved"; else status="unavailable"; fi

  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg status "${status}" --arg email "${email}" --arg project "${project}" \
      --arg workspace "${workspace}" --arg petSa "${petSa}" \
      '{status:$status, email:$email, project:$project, workspace:$workspace, petSa:$petSa}' \
      > "${IDENTITY_FILE}.tmp" 2>/dev/null && mv "${IDENTITY_FILE}.tmp" "${IDENTITY_FILE}" || true
  else
    printf '{"status":"unavailable"}' > "${IDENTITY_FILE}" 2>/dev/null || true
  fi
}

# Resolve in the background so a slow/blocked `wb` never delays the server (and
# thus the Workbench proxy-readiness check). The UI polls /api/identity.
resolve_identity &

exec node dist/server/index.js
