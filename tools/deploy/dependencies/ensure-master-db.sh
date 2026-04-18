#!/bin/bash
#
# Ensure the MASTER DB (espocrm_master by default) exists with the tenantInfo
# table and a default tenant row. Our fork's bootstrap.php reads this table on
# every request to resolve <subdomain>.host → tenant DB (commit fa6f571ed8).
#
# Executed on the TARGET host by deploy.sh.
#
# Usage:
#   ensure-master-db.sh <db_host> <db_port> <db_user> <db_pass> <master_db> \
#                       <default_slug> <default_dbname>
#
set -euo pipefail

DB_HOST="${1:-}"
DB_PORT="${2:-3306}"
DB_USER="${3:-}"
DB_PASS="${4:-}"
MASTER_DB="${5:-}"
SLUG="${6:-}"
TENANT_DB="${7:-}"

MYSQL_ROOT="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
MYSQL_M="$MYSQL_ROOT $MASTER_DB"

echo "  [master-db] ensure database '$MASTER_DB' exists" >&2
$MYSQL_ROOT -e "CREATE DATABASE IF NOT EXISTS \`$MASTER_DB\`
                CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "  [master-db] ensure tenantInfo table" >&2
$MYSQL_M <<SQL
CREATE TABLE IF NOT EXISTS tenantInfo (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(64)  NOT NULL UNIQUE,
    dbname        VARCHAR(128) NOT NULL,
    display_name  VARCHAR(255) NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
    INDEX (name),
    INDEX (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

echo "  [master-db] ensure default tenant row '$SLUG' → '$TENANT_DB'" >&2
$MYSQL_M -e "INSERT INTO tenantInfo (name, dbname, display_name, is_active)
             VALUES ('$SLUG', '$TENANT_DB', 'Master', 1)
             ON DUPLICATE KEY UPDATE dbname='$TENANT_DB', is_active=1;"

# Ensure the tenant's own DB exists too (bootstrap.php will fail fast if not)
echo "  [master-db] ensure tenant DB '$TENANT_DB' exists" >&2
$MYSQL_ROOT -e "CREATE DATABASE IF NOT EXISTS \`$TENANT_DB\`
                CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "  [master-db] OK" >&2
