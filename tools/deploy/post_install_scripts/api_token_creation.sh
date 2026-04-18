#!/bin/bash
#
# Post-install action: create/rotate an admin-type API token.
# =============================================================================
# Auto-discovered by deploy.sh (pattern: post_install_action_*.sh) and also
# runnable standalone.
#
# Why this is a post-install (not part of the main deploy code-push):
#   - It rotates a secret — you may want to rotate without a redeploy.
#   - Keeps demo data and application files untouched.
#   - Can be re-run safely (INSERT ... ON DUPLICATE KEY UPDATE in 'dedicated'
#     mode; ROW_COUNT()-checked UPDATE in 'upgrade' mode).
#
# Usage:
#   ./post_install_action_api_token_creation.sh <profile>
#
# On success, prints (parseable, last section):
#     CRM_API_KEY: <hex>
# =============================================================================

set -euo pipefail

PROFILE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_DIR="$SCRIPT_DIR/tenant-conf"
DEP_DIR="$SCRIPT_DIR/dependencies"

if [ -z "$PROFILE" ]; then
    echo "Usage: $0 <profile>"
    echo ""
    echo "Available profiles:"
    for f in "$CONF_DIR"/*.conf; do
        [ -f "$f" ] && echo "  $(basename "${f%.conf}")"
    done
    exit 1
fi

CONFIG_FILE="$CONF_DIR/${PROFILE}.conf"
[ -f "$CONFIG_FILE" ] || { echo "ERROR: profile config not found: $CONFIG_FILE" >&2; exit 1; }

parse_config() {
    local file="$1" section="$2" key="$3"
    awk -v section="[$section]" -v key="$key" '
        $0 == section { in_section=1; next }
        /^\[/         { in_section=0 }
        in_section {
            line = $0
            gsub(/^[ \t]+/, "", line)
            if (line ~ "^" key "[ \t]*=") {
                idx = index($0, "=")
                if (idx > 0) {
                    value = substr($0, idx + 1)
                    gsub(/^[ \t]+|[ \t]+$/, "", value)
                    sub(/[ \t]+;.*$/, "", value)
                    print value
                }
                exit
            }
        }' "$file"
}
g() { parse_config "$CONFIG_FILE" "$PROFILE" "$1"; }

SSH_HOST=$(g ssh_host)
SSH_PORT=$(g ssh_port); SSH_PORT="${SSH_PORT:-22}"
SSH_USER=$(g ssh_user)
SSH_KEY=$(g ssh_key);  SSH_KEY="${SSH_KEY/#\~/$HOME}"
MDB_HOST=$(g master_db_host)
MDB_PORT=$(g master_db_port); MDB_PORT="${MDB_PORT:-3306}"
MDB_USER=$(g master_db_user)
MDB_PASS=$(g master_db_password)
DEF_TDB=$(g default_tenant_dbname)
[ -z "$DEF_TDB" ] && DEF_TDB=$(g master_db_name)

API_MODE=$(g admin_api_mode);           API_MODE="${API_MODE:-dedicated}"
API_USER_NAME=$(g admin_api_user_name); API_USER_NAME="${API_USER_NAME:-admin_api}"
MAIN_ADMIN_NAME=$(g main_admin_name);   MAIN_ADMIN_NAME="${MAIN_ADMIN_NAME:-admin}"

for v in SSH_HOST SSH_USER SSH_KEY MDB_HOST MDB_USER DEF_TDB; do
    [ -z "${!v}" ] && { echo "ERROR: missing config '$v' in [$PROFILE]" >&2; exit 1; }
done
[ -f "$SSH_KEY" ] || { echo "ERROR: SSH key not found: $SSH_KEY" >&2; exit 1; }

SERVER="${SSH_USER}@${SSH_HOST}"
API_TARGET_USER=$( [ "$API_MODE" = "upgrade" ] && echo "$MAIN_ADMIN_NAME" || echo "$API_USER_NAME" )

echo "---- post_install: api_token_creation ----"
echo "  profile:   $PROFILE"
echo "  target:    ${SERVER}:${SSH_PORT}"
echo "  db:        $MDB_USER@$MDB_HOST:$MDB_PORT/$DEF_TDB"
echo "  api mode:  $API_MODE  user=$API_TARGET_USER"

CTRL="/tmp/espo-api-token-$$.sock"
cleanup() { ssh -O exit -o ControlPath="$CTRL" "$SERVER" 2>/dev/null || true; }
trap cleanup EXIT

ssh -o ControlMaster=yes -o ControlPath="$CTRL" -o ControlPersist=60 \
    -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
    -p "$SSH_PORT" -i "$SSH_KEY" -fN "$SERVER"

rs()  { ssh -o ControlPath="$CTRL" -p "$SSH_PORT" "$SERVER" "$@"; }
rcp() { scp -o ControlPath="$CTRL" -P "$SSH_PORT" "$@"; }

REMOTE_TMP=$(rs 'mktemp -d')
rcp "$DEP_DIR/setup-admin-api.sh" "${SERVER}:${REMOTE_TMP}/setup-admin-api.sh"

API_KEY=$(rs "chmod +x '$REMOTE_TMP/setup-admin-api.sh' && \
              '$REMOTE_TMP/setup-admin-api.sh' \
                  '$API_MODE' '$API_TARGET_USER' \
                  '$MDB_HOST' '$MDB_PORT' '$MDB_USER' '$MDB_PASS' '$DEF_TDB'" \
          2> >(sed 's/^/    /' >&2))

rs "rm -rf '$REMOTE_TMP'"

if [ -z "$API_KEY" ]; then
    echo "  ERROR: API key generation returned empty" >&2
    exit 1
fi

echo ""
echo "CRM_API_KEY: $API_KEY"
