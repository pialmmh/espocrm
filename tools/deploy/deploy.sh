#!/bin/bash
#
# EspoCRM — Remote Deploy (SSH-only, single pattern)
# =============================================================================
# Ships OUR multi-tenant fork of EspoCRM to a target host.
#
# "Local" = SSH to 127.0.0.1. There is no local-mode branch; all operations
# happen over a multiplexed SSH connection.
#
# Profile: <tenant>/<profile>.yml  (e.g. btcl/staging.yml).
# With no args, reads tenant-conf/active.conf to pick the active tenant+profile.
#
# Usage:
#   ./deploy.sh                         # use active tenant/profile
#   ./deploy.sh <tenant> <profile>      # explicit
#   ./deploy.sh <tenant> <profile> --skip-build
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEP_DIR="$SCRIPT_DIR/dependencies"
DEPLOY_DIR="$SCRIPT_DIR"

# shellcheck disable=SC1091
. "$DEP_DIR/profile-loader.sh"

# Separate positional (tenant/profile) from flag args.
SKIP_BUILD=false
POSITIONAL=()
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=true ;;
        -h|--help)
            sed -n '3,14p' "$0"; exit 0 ;;
        *) POSITIONAL+=( "$arg" ) ;;
    esac
done

resolve_profile "${POSITIONAL[@]:-}"
load_profile_vars
validate_profile_vars || exit 1

SERVER="${SSH_USER}@${SSH_HOST}"

# ----------------------------------------------------------------------------
# Plan
# ----------------------------------------------------------------------------
cat <<EOF
============================================================
  EspoCRM Deploy (SSH)
============================================================
Tenant/Prof:   $TENANT / $PROFILE${DESCRIPTION:+ — $DESCRIPTION}
Source:        $BASE_DIR
SSH target:    ${SERVER}:${SSH_PORT}  (key: $SSH_KEY)
Install path:  $TARGET_DIR
Ownership:     $WWW_USER:$WWW_GROUP
Serve:         systemd 'espocrm' on 0.0.0.0:${SERVE_PORT}
Site URL:      $SITE_URL
Master DB:     $MDB_USER@$MDB_HOST:$MDB_PORT/$MDB_NAME
Default slug:  $DEF_SLUG  →  $DEF_TDB
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
        (cd "$BASE_DIR" && git tag -a "$GIT_TAG" -m "EspoCRM deploy $GIT_TAG ($TENANT/$PROFILE)") || GIT_TAG="untagged"
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
            # Strip TEXT/BLOB/JSON DEFAULT literals inline — MySQL 5.7 rejects them
            # (only MySQL 8.0.13+ / MariaDB 10.2+ accept them). Safe because the
            # dump was produced on MariaDB and TEXT columns become 'no default'.
            gunzip -c \"\$DUMP\" \
                | perl -pe \"s/ DEFAULT '[^']*'(,?\\\$)/\\\$1/ if /\\\\b(tinytext|text|mediumtext|longtext|tinyblob|blob|mediumblob|longblob|json)\\\\b/i\" \
                | mysql -h '$MDB_HOST' -P '$MDB_PORT' -u '$MDB_USER' -p'$MDB_PASS' \
                    --init-command=\"SET SESSION sql_mode='';\" '$DEF_TDB'
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
        "$s" "$TENANT" "$PROFILE" | tee -a "$POST_OUTPUTS_FILE"
        rc="${PIPESTATUS[0]}"
        if [ "$rc" -ne 0 ]; then
            echo "ERROR: post-install script $(basename "$s") failed (rc=$rc)" >&2
            exit "$rc"
        fi
    done
fi

# Extract well-known KEY: value pairs from post-install outputs. Absence is
# non-fatal — a given deploy may not include all possible actions.
CRM_ADMIN_USER=$(awk     -F': +' '/^CRM_ADMIN_USER:/     { print $2; exit }' "$POST_OUTPUTS_FILE")
CRM_ADMIN_PASSWORD=$(awk -F': +' '/^CRM_ADMIN_PASSWORD:/ { print $2; exit }' "$POST_OUTPUTS_FILE")
CRM_AUTH_B64=$(awk       -F': +' '/^CRM_AUTH_B64:/       { print $2; exit }' "$POST_OUTPUTS_FILE")

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
tenant=$TENANT
profile=$PROFILE
tag=$GIT_TAG
commit=$GIT_COMMIT
branch=$GIT_BRANCH
master_db=$MDB_NAME
default_tenant=${DEF_SLUG}→${DEF_TDB}
site_url=$SITE_URL
admin_api_user=${CRM_ADMIN_USER:-}
deployed_at=$DEPLOY_TIME
deployed_by=$DEPLOYED_BY
VEOF
echo '$DEPLOY_TIME | $GIT_TAG ($GIT_COMMIT/$GIT_BRANCH) | $TENANT/$PROFILE | by=$DEPLOYED_BY' | sudo tee -a '$TARGET_DIR/deploy-history.log' > /dev/null
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

Credentials for the orchestrix-v2 Spring Boot api service (Basic auth —
Espo's X-Api-Key only accepts type=api users, which fail the hard
\$user->isAdmin() check on User/Role/Team/Settings endpoints; admin Basic
auth is the supported path):
    CRM_ADMIN_USER:     ${CRM_ADMIN_USER:-<not generated — run enable_api_permission.sh>}
    CRM_ADMIN_PASSWORD: ${CRM_ADMIN_PASSWORD:-<not generated>}
    CRM_AUTH_B64:       ${CRM_AUTH_B64:-<not generated>}

New tenants: POST $SITE_URL/api/v1/TenantManager/create  (from commit fa6f571ed8)

Rollback:
    ssh -i $SSH_KEY -p $SSH_PORT $SERVER
    sudo systemctl stop espocrm
    LATEST=\$(ls -1dt ${TARGET_DIR}.bak-* | head -1)
    sudo rm -rf $TARGET_DIR && sudo mv "\$LATEST" $TARGET_DIR
    sudo systemctl start espocrm

History:   ssh $SERVER 'cat $TARGET_DIR/deploy-history.log'
EOF
