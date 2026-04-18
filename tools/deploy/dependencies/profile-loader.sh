# -----------------------------------------------------------------------------
# profile-loader.sh — shared helpers sourced by deploy.sh and every
# post_install_scripts/*.sh. Not executable on its own.
#
# Exposes:
#   resolve_profile "$@"           → sets TENANT, PROFILE, CONFIG_FILE
#   yaml_get <key>                 → prints value from current CONFIG_FILE
#   load_profile_vars              → populates the full shell-var set below
#                                     (idempotent; safe to call multiple times)
#
# Configuration source:
#   <deploy_dir>/tenant-conf/<tenant>/<profile>.yml
#   If deploy.sh/post-install script invoked with 2 positional args, those are
#   used as <tenant> <profile>; otherwise <deploy_dir>/tenant-conf/active.conf
#   is read (simple key=value file; keys: tenant, profile).
#
# YAML parser: a deliberately tiny awk reader that understands only flat
# `key: value` pairs (no nesting, no arrays), `# comment` lines, and
# quoted or unquoted scalar values. This matches our profile format exactly.
# Fails loudly on anything else — do not extend the format beyond flat kv.
# -----------------------------------------------------------------------------

# Caller must set DEPLOY_DIR before sourcing this file.
: "${DEPLOY_DIR:?DEPLOY_DIR must be set by the caller before sourcing profile-loader.sh}"

CONF_ROOT="$DEPLOY_DIR/tenant-conf"
ACTIVE_FILE="$CONF_ROOT/active.conf"

resolve_profile() {
    local arg_tenant="${1:-}"
    local arg_profile="${2:-}"

    if [ -n "$arg_tenant" ] && [ -n "$arg_profile" ]; then
        TENANT="$arg_tenant"
        PROFILE="$arg_profile"
    else
        if [ ! -f "$ACTIVE_FILE" ]; then
            echo "ERROR: no tenant/profile args and $ACTIVE_FILE missing." >&2
            echo "       Either pass: <tenant> <profile>, or create active.conf." >&2
            return 1
        fi
        # shellcheck disable=SC1090
        . "$ACTIVE_FILE"
        TENANT="${tenant:-}"
        PROFILE="${profile:-}"
        if [ -z "$TENANT" ] || [ -z "$PROFILE" ]; then
            echo "ERROR: $ACTIVE_FILE must define tenant= and profile=" >&2
            return 1
        fi
    fi

    CONFIG_FILE="$CONF_ROOT/$TENANT/$PROFILE.yml"
    if [ ! -f "$CONFIG_FILE" ]; then
        echo "ERROR: profile config not found: $CONFIG_FILE" >&2
        echo ""                                                       >&2
        echo "Available tenants / profiles:"                          >&2
        for tdir in "$CONF_ROOT"/*/; do
            [ -d "$tdir" ] || continue
            echo "  $(basename "$tdir"):"                             >&2
            for pfile in "$tdir"*.yml; do
                [ -f "$pfile" ] || continue
                echo "    - $(basename "${pfile%.yml}")"              >&2
            done
        done
        return 1
    fi
}

# yaml_get <key>  — read flat `key: value` from CONFIG_FILE
yaml_get() {
    local key="$1"
    awk -v k="$key" '
        /^[ \t]*#/      { next }
        /^[ \t]*$/      { next }
        {
            line = $0
            # match:  key: value   or   key : value
            if (match(line, /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*:[ \t]*/)) {
                this_key = substr(line, RSTART, RLENGTH)
                sub(/[ \t]*:[ \t]*$/, "", this_key)
                gsub(/^[ \t]+/, "", this_key)
                if (this_key == k) {
                    value = substr(line, RSTART + RLENGTH)
                    # strip trailing comment
                    sub(/[ \t]+#.*$/, "", value)
                    # trim
                    gsub(/^[ \t]+|[ \t]+$/, "", value)
                    # strip one layer of matching quotes
                    if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
                        value = substr(value, 2, length(value) - 2)
                    }
                    print value
                    exit
                }
            }
        }' "$CONFIG_FILE"
}

load_profile_vars() {
    # Straight passthrough from YAML keys → shell-style UPPER vars used by the
    # rest of the toolkit. Defaults applied where the YAML may be silent.
    SSH_HOST=$(yaml_get ssh_host)
    SSH_PORT=$(yaml_get ssh_port);     SSH_PORT="${SSH_PORT:-22}"
    SSH_USER=$(yaml_get ssh_user)
    SSH_KEY=$(yaml_get ssh_key);       SSH_KEY="${SSH_KEY/#\~/$HOME}"

    TARGET_DIR=$(yaml_get target_dir)
    WWW_USER=$(yaml_get www_user);     WWW_USER="${WWW_USER:-www-data}"
    WWW_GROUP=$(yaml_get www_group);   WWW_GROUP="${WWW_GROUP:-www-data}"

    SERVE_PORT=$(yaml_get serve_port); SERVE_PORT="${SERVE_PORT:-7080}"
    SITE_URL=$(yaml_get site_url)

    MDB_HOST=$(yaml_get master_db_host)
    MDB_PORT=$(yaml_get master_db_port); MDB_PORT="${MDB_PORT:-3306}"
    MDB_NAME=$(yaml_get master_db_name)
    MDB_USER=$(yaml_get master_db_user)
    MDB_PASS=$(yaml_get master_db_password)

    DEF_SLUG=$(yaml_get default_tenant_slug);       DEF_SLUG="${DEF_SLUG:-master}"
    DEF_TDB=$(yaml_get default_tenant_dbname);      DEF_TDB="${DEF_TDB:-$MDB_NAME}"

    RUN_COMPOSER=$(yaml_get run_composer_install);  RUN_COMPOSER="${RUN_COMPOSER:-true}"
    RUN_NPM=$(yaml_get run_npm_build);              RUN_NPM="${RUN_NPM:-false}"

    KEEP_BACKUPS=$(yaml_get keep_backups);          KEEP_BACKUPS="${KEEP_BACKUPS:-3}"

    DESCRIPTION=$(yaml_get description)
}

validate_profile_vars() {
    local missing=0
    for v in SSH_HOST SSH_USER SSH_KEY TARGET_DIR SITE_URL MDB_HOST MDB_NAME MDB_USER; do
        if [ -z "${!v}" ]; then
            echo "ERROR: missing '$v' in $CONFIG_FILE" >&2
            missing=1
        fi
    done
    if [ -n "${SSH_KEY:-}" ] && [ ! -f "$SSH_KEY" ]; then
        echo "ERROR: SSH key not found: $SSH_KEY" >&2
        missing=1
    fi
    [ "$missing" -eq 0 ]
}
