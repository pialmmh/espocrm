#!/bin/bash
#
# Generate/rotate an admin-type API key in EspoCRM's master DB.
# Executed on the TARGET host by deploy.sh after the code is in place.
#
# Output (stdout, single line on success): the api_key value
# Output (stderr): human progress
#
# Usage:
#   setup-admin-api.sh <mode> <user_name> <db_host> <db_port> <db_user> <db_pass> <db_name>
#
#   mode = dedicated  → INSERT ... ON DUPLICATE KEY UPDATE for the named user
#   mode = upgrade    → UPDATE existing admin user (must already be type=admin)
#
set -euo pipefail

MODE="${1:-}"
USER_NAME="${2:-}"
DB_HOST="${3:-}"
DB_PORT="${4:-3306}"
DB_USER="${5:-}"
DB_PASS="${6:-}"
DB_NAME="${7:-}"

[ -z "$MODE" ] || [ -z "$USER_NAME" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ] && {
    echo "Usage: $0 <dedicated|upgrade> <user_name> <db_host> <db_port> <db_user> <db_pass> <db_name>" >&2
    exit 1
}

MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -N -B $DB_NAME"

case "$MODE" in
    dedicated)
        echo "  [admin-api] dedicated: ensure '$USER_NAME' is admin + ApiKey" >&2
        $MYSQL <<SQL
INSERT INTO user
    (id, user_name, type, auth_method, api_key, is_active, created_at,
     first_name, last_name)
VALUES
    (UUID(), '$USER_NAME', 'admin', 'ApiKey',
     SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), '$USER_NAME'), 256),
     1, NOW(), 'Admin', 'API')
ON DUPLICATE KEY UPDATE
    type        = 'admin',
    auth_method = 'ApiKey',
    api_key     = SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), '$USER_NAME'), 256),
    is_active   = 1;
SQL
        ;;
    upgrade)
        echo "  [admin-api] upgrade: rotate api_key on '$USER_NAME'" >&2
        ROWS=$($MYSQL -e "UPDATE user
            SET   auth_method='ApiKey',
                  api_key=SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), user_name), 256)
            WHERE user_name='$USER_NAME' AND type IN ('admin','super-admin');
            SELECT ROW_COUNT();")
        [ "$ROWS" = "0" ] && { echo "  [admin-api] ERROR: '$USER_NAME' not found or not admin" >&2; exit 2; }
        ;;
    *)
        echo "  [admin-api] ERROR: unknown mode '$MODE'" >&2
        exit 1
        ;;
esac

# Emit api_key
$MYSQL -e "SELECT api_key FROM user WHERE user_name='$USER_NAME';"
