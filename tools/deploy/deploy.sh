#!/bin/bash
#
# EspoCRM — Remote Deploy (SSH-only, single pattern)
# =============================================================================
# Ships OUR multi-tenant fork of EspoCRM to a target host.
#
# "Local" = SSH to 127.0.0.1. There is no local-mode branch; all operations
# happen over a multiplexed SSH connection.
#
# Source is whatever is checked out in this repo. The deploy is versioned
# against git (creates espo-v<ts> tag if HEAD is untagged).
#
# Usage:
#   ./deploy.sh <profile> [--skip-build]
#
# Example:
#   ./deploy.sh local
# =============================================================================

set -euo pipefail

PROFILE="${1:-}"
SKIP_BUILD=false
shift || true
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=true ;;
        *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONF_DIR="$SCRIPT_DIR/tenant-conf"
DEP_DIR="$SCRIPT_DIR/dependencies"

if [ -z "$PROFILE" ]; then
    echo "Usage: $0 <profile> [--skip-build]"
    echo ""
    echo "Available profiles:"
    for f in "$CONF_DIR"/*.conf; do
        [ -f "$f" ] && echo "  $(basename "${f%.conf}")"
    done
    exit 1
fi

CONFIG_FILE="$CONF_DIR/${PROFILE}.conf"
[ -f "$CONFIG_FILE" ] || { echo "ERROR: Profile config not found: $CONFIG_FILE" >&2; exit 1; }

# ----------------------------------------------------------------------------
# INI parser (same style as routesphere)
# ----------------------------------------------------------------------------
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
                    sub(/[ \t]+;.*$/, "", value)       # strip ; comment
                    print value
                }
                exit
            }
        }' "$file"
}
g() { parse_config "$CONFIG_FILE" "$PROFILE" "$1"; }

# ----------------------------------------------------------------------------
# Load profile
# ----------------------------------------------------------------------------
DESCRIPTION=$(g description)
SSH_HOST=$(g ssh_host)
SSH_PORT=$(g ssh_port); SSH_PORT="${SSH_PORT:-22}"
SSH_USER=$(g ssh_user)
SSH_KEY=$(g ssh_key); SSH_KEY="${SSH_KEY/#\~/$HOME}"
TARGET_DIR=$(g target_dir)
WWW_USER=$(g www_user);  WWW_USER="${WWW_USER:-www-data}"
WWW_GROUP=$(g www_group); WWW_GROUP="${WWW_GROUP:-www-data}"
SERVE_PORT=$(g serve_port); SERVE_PORT="${SERVE_PORT:-7080}"
SITE_URL=$(g site_url)

MDB_HOST=$(g master_db_host)
MDB_PORT=$(g master_db_port); MDB_PORT="${MDB_PORT:-3306}"
MDB_NAME=$(g master_db_name)
MDB_USER=$(g master_db_user)
MDB_PASS=$(g master_db_password)

DEF_SLUG=$(g default_tenant_slug);   DEF_SLUG="${DEF_SLUG:-master}"
DEF_TDB=$(g default_tenant_dbname);  DEF_TDB="${DEF_TDB:-$MDB_NAME}"

RUN_COMPOSER=$(g run_composer_install); RUN_COMPOSER="${RUN_COMPOSER:-true}"
RUN_NPM=$(g run_npm_build);              RUN_NPM="${RUN_NPM:-false}"

API_MODE=$(g admin_api_mode);           API_MODE="${API_MODE:-dedicated}"
API_USER_NAME=$(g admin_api_user_name); API_USER_NAME="${API_USER_NAME:-admin_api}"
MAIN_ADMIN_NAME=$(g main_admin_name);   MAIN_ADMIN_NAME="${MAIN_ADMIN_NAME:-admin}"
KEEP_BACKUPS=$(g keep_backups);         KEEP_BACKUPS="${KEEP_BACKUPS:-3}"

for v in SSH_HOST SSH_USER SSH_KEY TARGET_DIR SITE_URL MDB_HOST MDB_NAME MDB_USER; do
    [ -z "${!v}" ] && { echo "ERROR: missing config '$v' in [$PROFILE] of $CONFIG_FILE" >&2; exit 1; }
done
[ -f "$SSH_KEY" ] || { echo "ERROR: SSH key not found: $SSH_KEY" >&2; exit 1; }

SERVER="${SSH_USER}@${SSH_HOST}"

# ----------------------------------------------------------------------------
# Plan
# ----------------------------------------------------------------------------
cat <<EOF
============================================================
  EspoCRM Deploy (SSH)
============================================================
Profile:       $PROFILE${DESCRIPTION:+ — $DESCRIPTION}
Source:        $BASE_DIR
SSH target:    ${SERVER}:${SSH_PORT}  (key: $SSH_KEY)
Install path:  $TARGET_DIR
Ownership:     $WWW_USER:$WWW_GROUP
Serve:         systemd 'espocrm' on 0.0.0.0:${SERVE_PORT}
Site URL:      $SITE_URL
Master DB:     $MDB_USER@$MDB_HOST:$MDB_PORT/$MDB_NAME
Default slug:  $DEF_SLUG  →  $DEF_TDB
Admin API:     mode=$API_MODE  user=$( [ "$API_MODE" = "upgrade" ] && echo "$MAIN_ADMIN_NAME" || echo "$API_USER_NAME" )
Retention:     $KEEP_BACKUPS
Build:         composer=$RUN_COMPOSER  npm=$RUN_NPM  (skip=${SKIP_BUILD})
============================================================

EOF

# ----------------------------------------------------------------------------
# Git dirty-tree + version
# ----------------------------------------------------------------------------
echo "[1/9] Git status & version…"
if [ -d "$BASE_DIR/.git" ]; then
    DIRTY=$(cd "$BASE_DIR" && git status --porcelain | wc -l)
    if [ "$DIRTY" -gt 0 ]; then
        echo "  WARNING: $DIRTY uncommitted changes"
        (cd "$BASE_DIR" && git status --short | head -10)
        read -p "  Proceed anyway? [y/N] " A
        case "$A" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac
    fi
    GIT_COMMIT=$(cd "$BASE_DIR" && git rev-parse --short HEAD)
    GIT_BRANCH=$(cd "$BASE_DIR" && git rev-parse --abbrev-ref HEAD)
    GIT_TAG=$(cd "$BASE_DIR" && git describe --tags --exact-match HEAD 2>/dev/null || echo "untagged")
    TS=$(date '+%Y%m%d-%H%M%S')
    if [ "$GIT_TAG" = "untagged" ]; then
        GIT_TAG="espo-v${TS}"
        echo "  creating tag: $GIT_TAG"
        (cd "$BASE_DIR" && git tag -a "$GIT_TAG" -m "EspoCRM deploy $GIT_TAG (profile=$PROFILE)") || GIT_TAG="untagged"
    fi
else
    GIT_COMMIT="unknown"; GIT_BRANCH="unknown"; GIT_TAG="untagged"
    TS=$(date '+%Y%m%d-%H%M%S')
fi
echo "  $GIT_TAG  ($GIT_COMMIT, branch=$GIT_BRANCH)"
echo ""

# ----------------------------------------------------------------------------
# Build locally (composer install → vendor/ shipped in tarball)
# ----------------------------------------------------------------------------
echo "[2/9] Local build…"
if [ "$SKIP_BUILD" = false ] && [ "$RUN_COMPOSER" = "true" ]; then
    command -v composer >/dev/null || { echo "  ERROR: composer not on PATH" >&2; exit 1; }
    (cd "$BASE_DIR" && composer install --no-dev --optimize-autoloader --no-interaction --quiet)
    echo "  composer install: done"
else
    echo "  composer install: SKIPPED"
fi
if [ "$SKIP_BUILD" = false ] && [ "$RUN_NPM" = "true" ]; then
    (cd "$BASE_DIR" && npm ci --silent && npm run build --silent)
    echo "  npm build: done"
fi
echo ""

# ----------------------------------------------------------------------------
# Tarball (exclude noise; INCLUDE vendor/ + data/fresh_dump.sql.gz +
# custom/Espo/Custom/** which holds our multi-tenant bits)
# ----------------------------------------------------------------------------
echo "[3/9] Packaging…"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
TARBALL="$STAGE/espocrm-${GIT_TAG}.tar.gz"
tar -czf "$TARBALL" \
    --exclude='.git' --exclude='.idea' --exclude='.vscode' \
    --exclude='node_modules' --exclude='tests' --exclude='build' \
    --exclude='docs' --exclude='*.log' --exclude='espo-admin-full.png' \
    --exclude='data/cache' --exclude='data/logs' --exclude='data/tmp' \
    --exclude='data/upload' \
    --exclude='tools/deploy' \
    -C "$BASE_DIR" .
SIZE=$(du -h "$TARBALL" | cut -f1)
echo "  $TARBALL ($SIZE)"
echo ""

# ----------------------------------------------------------------------------
# SSH master connection
# ----------------------------------------------------------------------------
CTRL="/tmp/espo-deploy-$$.sock"
cleanup() {
    ssh -O exit -o ControlPath="$CTRL" "$SERVER" 2>/dev/null || true
    rm -rf "$STAGE"
}
trap cleanup EXIT

echo "[4/9] Opening SSH master → $SERVER:$SSH_PORT…"
ssh -o ControlMaster=yes -o ControlPath="$CTRL" -o ControlPersist=600 \
    -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
    -p "$SSH_PORT" -i "$SSH_KEY" -fN "$SERVER"
echo "  connected"
echo ""

rs()  { ssh  -o ControlPath="$CTRL" -p "$SSH_PORT" "$SERVER" "$@"; }
rcp() { scp  -o ControlPath="$CTRL" -P "$SSH_PORT" "$@"; }

# ----------------------------------------------------------------------------
# Remote prerequisite check
# ----------------------------------------------------------------------------
echo "[5/9] Remote prereqs (php, mysql client, rsync)…"
MISSING=$(rs 'for c in php mysql rsync tar; do command -v $c >/dev/null || echo $c; done')
if [ -n "$MISSING" ]; then
    echo "  ERROR: missing on target: $MISSING" >&2
    echo "  install on target first (sudo apt install php-cli php-mysql mysql-client rsync) and rerun." >&2
    exit 1
fi
rs 'php -v | head -1'
echo ""

# ----------------------------------------------------------------------------
# Upload + extract
# ----------------------------------------------------------------------------
echo "[6/9] Upload & extract…"
REMOTE_TMP="/tmp/espo-deploy-$$"
rs "mkdir -p $REMOTE_TMP"
rcp "$TARBALL" "${SERVER}:${REMOTE_TMP}/espocrm.tar.gz"
rcp "$DEP_DIR/setup-admin-api.sh"   "${SERVER}:${REMOTE_TMP}/setup-admin-api.sh"
rcp "$DEP_DIR/ensure-master-db.sh"  "${SERVER}:${REMOTE_TMP}/ensure-master-db.sh"
rcp "$DEP_DIR/espocrm.service"      "${SERVER}:${REMOTE_TMP}/espocrm.service.tpl"

# Backup previous + extract fresh — preserving data/ and custom/
rs "set -e
    if [ -d '$TARGET_DIR' ] && [ \"\$(ls -A '$TARGET_DIR' 2>/dev/null)\" ]; then
        sudo cp -a '$TARGET_DIR' '${TARGET_DIR}.bak-${TS}'
        echo '  backup: ${TARGET_DIR}.bak-${TS}'
        ls -1dt ${TARGET_DIR}.bak-* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r sudo rm -rf
    fi
    sudo mkdir -p '$TARGET_DIR'
    # Preserve data/ and custom/ by staging them aside before extract
    STASH=\$(mktemp -d)
    for d in data custom; do
        [ -d '$TARGET_DIR'/\$d ] && sudo mv '$TARGET_DIR'/\$d \"\$STASH/\$d\"
    done
    sudo rm -rf '$TARGET_DIR'/*
    sudo tar -xzf '$REMOTE_TMP/espocrm.tar.gz' -C '$TARGET_DIR'
    # Restore preserved dirs; new ones from tarball become defaults only if absent
    for d in data custom; do
        if [ -d \"\$STASH/\$d\" ]; then
            sudo rm -rf '$TARGET_DIR'/\$d
            sudo mv \"\$STASH/\$d\" '$TARGET_DIR'/\$d
        fi
    done
    rm -rf \"\$STASH\"
    # Ownership on writable paths
    sudo chown -R $WWW_USER:$WWW_GROUP '$TARGET_DIR/data' '$TARGET_DIR/custom' 2>/dev/null || true
    sudo mkdir -p '$TARGET_DIR/application/Espo/Modules' '$TARGET_DIR/public/client/custom'
    sudo chown -R $WWW_USER:$WWW_GROUP '$TARGET_DIR/application/Espo/Modules' '$TARGET_DIR/public/client/custom'
    echo '  extract OK'
"
echo ""

# ----------------------------------------------------------------------------
# Remote DB: ensure master DB + default tenant row + tenant DB
# ----------------------------------------------------------------------------
echo "[7/9] Ensuring master DB + default tenant…"
rs "chmod +x '$REMOTE_TMP/ensure-master-db.sh' && \
    '$REMOTE_TMP/ensure-master-db.sh' \
        '$MDB_HOST' '$MDB_PORT' '$MDB_USER' '$MDB_PASS' \
        '$MDB_NAME' '$DEF_SLUG' '$DEF_TDB'"

# Import fresh_dump into the tenant DB IF it's empty (first-time install)
rs "set -e
    COUNT=\$(mysql -h '$MDB_HOST' -P '$MDB_PORT' -u '$MDB_USER' -p'$MDB_PASS' -N -B -e \
        \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DEF_TDB';\" 2>/dev/null || echo 0)
    if [ \"\$COUNT\" = \"0\" ]; then
        DUMP='$TARGET_DIR/data/fresh_dump.sql.gz'
        if [ -f \"\$DUMP\" ]; then
            echo '  tenant DB empty — importing data/fresh_dump.sql.gz'
            gunzip -c \"\$DUMP\" | mysql -h '$MDB_HOST' -P '$MDB_PORT' -u '$MDB_USER' -p'$MDB_PASS' '$DEF_TDB'
            echo '  fresh_dump imported'
        else
            echo '  WARNING: tenant DB empty and fresh_dump.sql.gz not present in target; you must provision schema manually.'
        fi
    else
        echo '  tenant DB already has \$COUNT tables — no fresh_dump import'
    fi
"

# Espo rebuild
rs "cd '$TARGET_DIR' && sudo -u $WWW_USER php bin/command rebuild 2>&1 | tail -5" || echo "  WARN: rebuild had issues (see above)"
echo ""

# ----------------------------------------------------------------------------
# systemd unit (built-in PHP server — swap for nginx/fpm in production profile)
# ----------------------------------------------------------------------------
echo "[8/9] systemd unit…"
rs "sudo sed -e 's|\${WWW_USER}|$WWW_USER|g' \
             -e 's|\${WWW_GROUP}|$WWW_GROUP|g' \
             -e 's|\${TARGET_DIR}|$TARGET_DIR|g' \
             -e 's|\${SERVE_PORT}|$SERVE_PORT|g' \
             '$REMOTE_TMP/espocrm.service.tpl' > /tmp/espocrm.service.tmp && \
     sudo mv /tmp/espocrm.service.tmp /etc/systemd/system/espocrm.service && \
     sudo systemctl daemon-reload && \
     sudo systemctl enable espocrm >/dev/null 2>&1 && \
     sudo systemctl restart espocrm && \
     sleep 1 && sudo systemctl is-active espocrm"
echo ""

# ----------------------------------------------------------------------------
# Post-install actions — auto-discover every post_install_action_*.sh next to
# deploy.sh and run them in sorted order. Each is self-contained, takes the
# profile as its only arg, and manages its own SSH connection. Add more by
# dropping a new post_install_action_<name>.sh here — no changes to deploy.sh
# needed.
#
# Convention: scripts MAY print `KEY: value` lines on stdout (e.g.
# `CRM_API_KEY: …`). We collect those so the final banner can echo them back.
# ----------------------------------------------------------------------------
echo "[9/9] Post-install actions…"
# Close our SSH master so each post_install_action_* can open its own.
ssh -O exit -o ControlPath="$CTRL" "$SERVER" 2>/dev/null || true

POST_OUTPUTS_FILE=$(mktemp)
trap "rm -f '$POST_OUTPUTS_FILE'" EXIT

POST_DIR="$SCRIPT_DIR/post_install_scripts"
shopt -s nullglob
POST_SCRIPTS=( "$POST_DIR"/*.sh )
shopt -u nullglob

if [ "${#POST_SCRIPTS[@]}" -eq 0 ]; then
    echo "  (no scripts in $POST_DIR — skipping)"
else
    IFS=$'\n' POST_SCRIPTS=( $(printf "%s\n" "${POST_SCRIPTS[@]}" | sort) )

    echo ""
    echo "  Available post-install scripts:"
    echo "    a) Run ALL"
    for i in "${!POST_SCRIPTS[@]}"; do
        printf "    %d) %s\n" $((i + 1)) "$(basename "${POST_SCRIPTS[$i]}")"
    done
    echo "    s) Skip all"
    echo ""
    read -p "  Select: 'a' for all, 's' to skip, or numbers (e.g. '1,3'): " SEL
    SEL=$(echo "$SEL" | tr -d '[:space:]')

    SELECTED=()
    case "$SEL" in
        a|A|all)
            SELECTED=( "${POST_SCRIPTS[@]}" )
            ;;
        s|S|skip|"")
            echo "  Skipping all post-install scripts."
            ;;
        *)
            # Parse comma-separated numbers
            IFS=',' read -ra NUMS <<< "$SEL"
            for n in "${NUMS[@]}"; do
                if ! [[ "$n" =~ ^[0-9]+$ ]] || [ "$n" -lt 1 ] || [ "$n" -gt "${#POST_SCRIPTS[@]}" ]; then
                    echo "  ERROR: invalid selection '$n' (valid: 1..${#POST_SCRIPTS[@]}, 'a', or 's')" >&2
                    exit 1
                fi
                SELECTED+=( "${POST_SCRIPTS[$((n - 1))]}" )
            done
            ;;
    esac

    for s in "${SELECTED[@]}"; do
        echo ""
        echo ">>> $(basename "$s")"
        chmod +x "$s"
        "$s" "$PROFILE" | tee -a "$POST_OUTPUTS_FILE"
        rc="${PIPESTATUS[0]}"
        if [ "$rc" -ne 0 ]; then
            echo "ERROR: post-install script $(basename "$s") failed (rc=$rc)" >&2
            exit "$rc"
        fi
    done
fi

# Extract known keys emitted by post-install scripts (e.g. CRM_API_KEY) for
# the final banner / version.txt. Absence is not fatal — a future deploy may
# not include an API-token action.
API_KEY=$(awk -F': +' '/^CRM_API_KEY:/ { print $2; exit }' "$POST_OUTPUTS_FILE")
API_TARGET_USER=$( [ "$API_MODE" = "upgrade" ] && echo "$MAIN_ADMIN_NAME" || echo "$API_USER_NAME" )

# Reopen SSH master for the final version.txt / history write
ssh -o ControlMaster=yes -o ControlPath="$CTRL" -o ControlPersist=60 \
    -p "$SSH_PORT" -i "$SSH_KEY" -fN "$SERVER"
echo ""

# ----------------------------------------------------------------------------
# Version + history on target
# ----------------------------------------------------------------------------
DEPLOY_TIME=$(date '+%Y-%m-%d %H:%M:%S %z')
DEPLOYED_BY=$(whoami)
rs "sudo tee '$TARGET_DIR/version.txt' > /dev/null <<VEOF
project=espocrm
profile=$PROFILE
tag=$GIT_TAG
commit=$GIT_COMMIT
branch=$GIT_BRANCH
master_db=$MDB_NAME
default_tenant=${DEF_SLUG}→${DEF_TDB}
site_url=$SITE_URL
admin_api_user=$API_TARGET_USER
deployed_at=$DEPLOY_TIME
deployed_by=$DEPLOYED_BY
VEOF
echo '$DEPLOY_TIME | $GIT_TAG ($GIT_COMMIT/$GIT_BRANCH) | profile=$PROFILE | admin_api=$API_TARGET_USER | by=$DEPLOYED_BY' | sudo tee -a '$TARGET_DIR/deploy-history.log' > /dev/null
sudo chown $WWW_USER:$WWW_GROUP '$TARGET_DIR/version.txt' '$TARGET_DIR/deploy-history.log'
rm -rf $REMOTE_TMP"

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
cat <<EOF
============================================================
  Deploy complete
============================================================
Target:         $TARGET_DIR  on  $SERVER:$SSH_PORT
Version:        $GIT_TAG  ($GIT_COMMIT on $GIT_BRANCH)
Service:        systemctl status espocrm  (port $SERVE_PORT)
Site URL:       $SITE_URL
Master DB:      $MDB_NAME
Default tenant: $DEF_SLUG → $DEF_TDB

CRM_API_KEY for the orchestrix-v2 Spring Boot api service:
    $API_KEY

New tenants: POST $SITE_URL/api/v1/TenantManager/create  (from commit fa6f571ed8)

Rollback:
    ssh -i $SSH_KEY -p $SSH_PORT $SERVER
    sudo systemctl stop espocrm
    LATEST=\$(ls -1dt ${TARGET_DIR}.bak-* | head -1)
    sudo rm -rf $TARGET_DIR && sudo mv "\$LATEST" $TARGET_DIR
    sudo systemctl start espocrm

History:   ssh $SERVER 'cat $TARGET_DIR/deploy-history.log'
EOF
