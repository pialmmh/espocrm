#!/bin/bash
#
# Post-install: enable API permission for the orchestrix-v2 Spring Boot proxy.
# =============================================================================
# Takes admin credentials, verifies them against the live Espo install by
# hitting /api/v1/App/user with HTTP Basic auth, then emits the credentials
# (and a pre-computed base64 token) for the proxy to use.
#
# Why not X-Api-Key? EspoCRM's ApiKey login handler hard-filters
# `type = User::TYPE_API` (application/Espo/Core/Authentication/Helper/
# UserFinder.php:83-93). An api-type user then fails the `$user->isAdmin()`
# gate on User/Role/Team/Settings controllers. Admin Basic auth is the only
# supported path that works for admin endpoints.
#
# Usage:
#   ./enable_api_permission.sh                        # active profile
#   ./enable_api_permission.sh <tenant> <profile>
#   ./enable_api_permission.sh btcl staging --user admin --password admin
#   CRM_ADMIN_USER=admin CRM_ADMIN_PASSWORD=admin ./enable_api_permission.sh
#
# On success, last section of stdout (parseable by deploy.sh):
#     CRM_ADMIN_USER: <user>
#     CRM_ADMIN_PASSWORD: <pass>
#     CRM_AUTH_B64: <base64(user:pass)>
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEP_DIR="$DEPLOY_DIR/dependencies"

# shellcheck disable=SC1091
. "$DEP_DIR/profile-loader.sh"

# ----------------------------------------------------------------------------
# Parse args: [<tenant> <profile>] [--user U] [--password P]
# Positional tenant/profile come first (same shape as deploy.sh).
# ----------------------------------------------------------------------------
POSITIONAL=()
ARG_USER="${CRM_ADMIN_USER:-}"
ARG_PASS="${CRM_ADMIN_PASSWORD:-}"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --user)     ARG_USER="${2:-}"; shift 2 ;;
        --password) ARG_PASS="${2:-}"; shift 2 ;;
        --help|-h)  sed -n '3,25p' "$0"; exit 0 ;;
        *)          POSITIONAL+=( "$1" ); shift ;;
    esac
done

resolve_profile "${POSITIONAL[@]:-}"
load_profile_vars

for v in SSH_HOST SSH_USER SSH_KEY SITE_URL DEF_SLUG; do
    [ -z "${!v}" ] && { echo "ERROR: missing '$v' in $CONFIG_FILE" >&2; exit 1; }
done
[ -f "$SSH_KEY" ] || { echo "ERROR: SSH key not found: $SSH_KEY" >&2; exit 1; }

# ----------------------------------------------------------------------------
# Resolve admin credentials — prompt if not supplied.
# ----------------------------------------------------------------------------
if [ -z "$ARG_USER" ]; then
    read -r -p "  Espo admin user [admin]: " ARG_USER
    ARG_USER="${ARG_USER:-admin}"
fi
if [ -z "$ARG_PASS" ]; then
    read -r -s -p "  Espo admin password: " ARG_PASS
    echo
fi
[ -z "$ARG_PASS" ] && { echo "ERROR: admin password is required" >&2; exit 1; }

# ----------------------------------------------------------------------------
# Compute the Host header. Our multi-tenant bootstrap (commit fa6f571ed8)
# maps <slug>.host → tenant DB; slug 'master' requires a plain host without
# a dotted prefix.
# ----------------------------------------------------------------------------
HOST_ONLY="${SITE_URL#*://}"              # strip scheme
HOST_ONLY="${HOST_ONLY%%/*}"              # strip path
if [ "$DEF_SLUG" != "master" ]; then
    API_HOST_HDR="${DEF_SLUG}.${HOST_ONLY}"
else
    API_HOST_HDR="$HOST_ONLY"
fi

SERVER="${SSH_USER}@${SSH_HOST}"

echo "---- post_install: enable_api_permission ----"
echo "  profile:  $TENANT/$PROFILE"
echo "  target:   ${SERVER}:${SSH_PORT}"
echo "  site:     $SITE_URL   (Host: $API_HOST_HDR)"
echo "  admin:    $ARG_USER"

# ----------------------------------------------------------------------------
# Verify over SSH (curl runs on the target, hits its own site_url locally).
# ----------------------------------------------------------------------------
CTRL="/tmp/espo-enable-api-$$.sock"
cleanup() { ssh -O exit -o ControlPath="$CTRL" "$SERVER" 2>/dev/null || true; }
trap cleanup EXIT

ssh -o ControlMaster=yes -o ControlPath="$CTRL" -o ControlPersist=60 \
    -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
    -p "$SSH_PORT" -i "$SSH_KEY" -fN "$SERVER"

rs() { ssh -o ControlPath="$CTRL" -p "$SSH_PORT" "$SERVER" "$@"; }

# quote single-quotes safely for the inner shell
q() { printf "%s" "$1" | sed "s/'/'\\\\''/g"; }

STATUS=$(rs "curl -s -o /tmp/espo-verify-$$.json \
                  -w '%{http_code}' \
                  -H 'Host: $(q "$API_HOST_HDR")' \
                  -u '$(q "$ARG_USER"):$(q "$ARG_PASS")' \
                  '$(q "$SITE_URL")/api/v1/App/user'")

if [ "$STATUS" != "200" ]; then
    echo ""
    echo "  ERROR: verification failed (HTTP $STATUS)" >&2
    echo "  Response body (first 300 chars):" >&2
    rs "head -c 300 /tmp/espo-verify-$$.json; echo; rm -f /tmp/espo-verify-$$.json" >&2
    exit 1
fi

# Pull back a snippet for confirmation — who is this login seen as?
rs "php -r 'echo json_decode(file_get_contents(\"/tmp/espo-verify-$$.json\"))->user->userName ?? \"(unknown)\";'" \
    > /tmp/espo-verify-local-$$ 2>/dev/null || true
AUTHED_AS=$(cat /tmp/espo-verify-local-$$ 2>/dev/null || echo "")
rm -f /tmp/espo-verify-local-$$
rs "rm -f /tmp/espo-verify-$$.json"

B64=$(printf "%s:%s" "$ARG_USER" "$ARG_PASS" | base64 -w0)

echo "  verified: HTTP 200 — authenticated as '${AUTHED_AS:-$ARG_USER}'"
echo ""
echo "CRM_ADMIN_USER: $ARG_USER"
echo "CRM_ADMIN_PASSWORD: $ARG_PASS"
echo "CRM_AUTH_B64: $B64"
